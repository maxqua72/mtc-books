import { defineStore } from 'pinia';
import { Chess } from 'chess.js';

export interface ChessMoveNode {
  id: string;
  san: string;
  fen: string;
  moveNumber: number;
  color: 'w' | 'b';
  parentId: string | null;
  comment: string | null;
  children: ChessMoveNode[];
}

export interface ChessTree {
  id: string;
  title: string;
  startingFen: string;
  rootNodes: ChessMoveNode[];
  activeNodeId: string | null;
}

// Interfaccia per il segnale reattivo destinato a Tiptap
export interface MoveSignalPayload {
  id: string;
  san: string;
  color: 'w' | 'b';
  moveNumber: number;
  isVariant?: boolean; // Facoltativo: indica se la mossa è una variante o meno
}

export const useChessTreeStore = defineStore('chessTree', {
  state: () => ({
    trees: [] as ChessTree[],
    activeTreeId: null as string | null,
    activeNodeId: null as string | null,
    activeFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    isRecordingMoves: false,
    // Nuovo segnale reattivo per notificare l'editor senza passargli l'istanza
    lastRecordedMoveSignal: null as MoveSignalPayload | null,
    lastDeletedMoveId: null as string | null,
  }),

  getters: {
    currentTree(): ChessTree | undefined {
      return this.trees.find(t => t.id === this.activeTreeId);
    },

    /**
     * Trova ricorsivamente un nodo specifico all'interno di un albero
     */
    findNodeById: () => (nodes: ChessMoveNode[], id: string): ChessMoveNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children.length > 0) {
          const found = useChessTreeStore().findNodeById(node.children, id);
          if (found) return found;
        }
      }
      return null;
    },

    currentNode(): ChessMoveNode | null {
      if (!this.activeNodeId || !this.currentTree) return null;
      return this.findNodeById(this.currentTree.rootNodes, this.activeNodeId);
    }
  },

  actions: {
    /**
     * Inizializza un nuovo albero (Partita o Posizione di studio separata)
     */
    createNewTree(title = 'Nuova Analisi', customFen?: string) {
      const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const startingFen = customFen || defaultFen;

      const newTree: ChessTree = {
        id: `tree-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title,
        startingFen,
        rootNodes: [],
        activeNodeId: null
      };

      this.trees.push(newTree);
      this.activeTreeId = newTree.id;
      this.activeNodeId = null;
      this.activeFen = startingFen;
      return newTree;
    },

    /**
     * Naviga verso un nodo specifico impostando FEN e ID attivi
     */
    setActiveNode(nodeId: string | null) {
      this.activeNodeId = nodeId

      // Salva lo stato anche dentro l'albero corrente
      const current = this.trees.find(t => t.id === this.activeTreeId)
      if (current) {
        current.activeNodeId = nodeId
      }

      // Aggiorna il FEN sulla scacchiera
      if (nodeId === null) {
        this.activeFen = current?.startingFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      } else {
        const node = this.findNodeById(current?.rootNodes || [], nodeId)
        if (node) {
          this.activeFen = node.fen
        }
      }
    },

    /**
     * Aggiunge una mossa eseguita sulla scacchiera all'albero corrente
     * Gestisce automaticamente la creazione di varianti se si riparte da un nodo intermedio
     */
    addMove(san: string, fen: string) {
      if (!this.currentTree) return null;

      // Inizializziamo chess.js sul FEN precedente per estrarre info su colore e numero mossa
      const chess = new Chess(this.activeFen);
      const color = chess.turn(); // 'w' o 'b'
      const moveNumber = chess.moveNumber();

      // Determiniamo la lista di nodi in cui cercare/inserire la mossa
      let siblingNodes: ChessMoveNode[];
      if (this.activeNodeId === null) {
        siblingNodes = this.currentTree.rootNodes;
      } else {
        const parentNode = this.currentNode;
        if (!parentNode) return null;
        siblingNodes = parentNode.children;
      }

      // 1. Controlla se la mossa esiste già tra i fratelli (l'utente sta ripercorrendo una linea)
      const existingNode = siblingNodes.find(n => n.san === san);
      if (existingNode) {
        this.activeNodeId = existingNode.id;
        this.activeFen = existingNode.fen;
        return { node: existingNode, isNew: false };
      }

      // 2. Crea un nuovo nodo per la mossa
      const newNode: ChessMoveNode = {
        id: `move-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        san,
        fen,
        moveNumber,
        color,
        parentId: this.activeNodeId,
        comment: null,
        children: []
      };

      // 3. Inserisci il nodo nell'albero
      siblingNodes.push(newNode);

      // 4. Aggiorna lo stato di navigazione
      this.activeNodeId = newNode.id;
      this.activeFen = newNode.fen;

      // Modifica: Genera il segnale per l'editor se la scrittura live è attiva
      if (this.isRecordingMoves) {
        // È una variante se ci sono già altre mosse alternative registrate nello stesso punto (fratelli)
        const isVariantMove = siblingNodes.length > 1;

        this.lastRecordedMoveSignal = {
          id: newNode.id,
          san: newNode.san,
          color: newNode.color,
          moveNumber: newNode.moveNumber,
          isVariant: isVariantMove // <-- Riconosciuto nativamente dall'interfaccia MoveSignalPayload
        };
      }

      return { node: newNode, isNew: true };
    },

    /**
     * Elimina una variante o una mossa specifica (Pruning dell'albero)
     */
    deleteBranch(nodeId: string) {
      if (!this.currentTree) return false;

      this.lastDeletedMoveId = nodeId;

      const removeNodeRecursive = (nodes: ChessMoveNode[]): boolean => {
        const index = nodes.findIndex(n => n.id === nodeId);
        if (index !== -1) {
          const parentId = nodes[index].parentId;
          nodes.splice(index, 1);
          if (this.activeNodeId === nodeId || this.isNodeDescendantOf(this.activeNodeId, nodeId)) {
            this.setActiveNode(parentId);
          }
          return true;
        }

        for (const node of nodes) {
          if (node.children.length > 0) {
            if (removeNodeRecursive(node.children)) return true;
          }
        }
        return false;
      };

      return removeNodeRecursive(this.currentTree.rootNodes);
    },

    /**
     * Utility per verificare se un nodo è discendente di un altro
     */
    isNodeDescendantOf(childId: string | null, parentId: string): boolean {
      if (!childId || !this.currentTree) return false;
      let current = this.findNodeById(this.currentTree.rootNodes, childId);

      while (current && current.parentId !== null) {
        if (current.parentId === parentId) return true;
        current = this.findNodeById(this.currentTree.rootNodes, current.parentId);
      }
      return false;
    },

    /**
     * Reset completo dello store
     */
    resetStore() {
      this.trees = [];
      this.activeTreeId = null;
      this.activeNodeId = null;
      this.activeFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      this.isRecordingMoves = false;
      this.lastRecordedMoveSignal = null;
    },

    /**
     * Aggiorna il commento di una mossa specifica
     */
    updateNodeComment(nodeId: string, comment: string | null) {
      if (!this.currentTree) return;
      const node = this.findNodeById(this.currentTree.rootNodes, nodeId);
      if (node) {
        node.comment = comment === '' ? null : comment;
      }
    },

    /**
     * Importa un intero testo PGN costruendo l'albero delle mosse corrispondente
     */
    importPgn(pgnString: string) {
      if (!this.currentTree) return false;

      const chess = new Chess();
      try {
        // Carica il PGN nell'istanza temporanea di chess.js
        chess.loadPgn(pgnString);
        
        // Estrae la cronologia completa in modalità verbosa (include FEN e notazione SAN)
        const history = chess.history({ verbose: true });
        
        // Resetta la navigazione all'inizio dell'albero corrente per iniziare l'importazione
        this.setActiveNode(null);

        // Cicla sequenzialmente tutte le mosse estratte dal PGN
        for (const move of history) {
          // Usiamo la logica nativa di addMove. 
          // Se la mossa esiste già sposta solo il cursore, altrimenti crea il nodo.
          this.addMove(move.san, move.after);
        }

        return true;
      } catch (error) {
        console.error("[ChessTreeStore] Errore durante il parsing del PGN:", error);
        return false;
      }
    }
  }
});