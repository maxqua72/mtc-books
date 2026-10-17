import { defineStore } from 'pinia'
import { Chess } from 'chess.js'
import { STANDARD_FEN, isLegalFen, normalizeFen } from '../utils/fen'

export interface ChessMoveNode {
  id: string
  san: string
  fen: string
  moveNumber: number
  color: 'w' | 'b'
  parentId: string | null
  comment: string | null
  nags?: number[]          // simboli di annotazione PGN (1 = !, 2 = ?, ...)
  children: ChessMoveNode[]
}

export interface ChessTree {
  id: string
  title: string
  startingFen: string
  rootNodes: ChessMoveNode[]
  activeNodeId: string | null
  header?: Record<string, string>   // tag PGN della partita di origine (solo alberi importati)
  showHeader?: boolean              // mostra l'intestazione nel documento
  parentTreeId?: string | null
  splitAtNodeId?: string | null
}

export type FenResult = 'ok' | 'invalid' | 'locked'

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

const findNode = (nodes: ChessMoveNode[] | undefined, id: string): ChessMoveNode | null => {
  const stack = [...(nodes ?? [])]
  while (stack.length) {
    const n = stack.pop()!
    if (n.id === id) return n
    if (n.children?.length) stack.push(...n.children)
  }
  return null
}

// Tetto di nodi della cronologia temporanea: oltre, riparte dalla posizione corrente
const SCRATCH_MAX_NODES = 2000

// Copia profonda dei nodi con id nuovi (e parentId coerenti): due alberi non condividono mai nulla
const cloneNodes = (nodes: ChessMoveNode[], parentId: string | null): ChessMoveNode[] =>
  nodes.map(n => {
    const id = newId('move')
    return {
      ...n,
      id,
      parentId,
      ...(n.nags ? { nags: [...n.nags] } : {}),
      children: cloneNodes(n.children, id),
    }
  })

const cloneTree = (src: ChessTree, title: string): ChessTree => ({
  id: newId('tree'),
  title,
  startingFen: src.startingFen,
  rootNodes: cloneNodes(src.rootNodes, null),
  activeNodeId: null,
  ...(src.header ? { header: { ...src.header }, showHeader: src.showHeader === true } : {}),
})

const countNodes = (nodes: ChessMoveNode[]): number => {
  let total = 0
  const stack = [...nodes]
  while (stack.length) {
    const n = stack.pop()!
    total++
    if (n.children?.length) stack.push(...n.children)
  }
  return total
}

/**
 * Modello: la scacchiera è in modalità LIBERA (activeTreeId === null) oppure in modalità ALBERO
 * (activeTreeId valorizzato: la posizione deriva dal nodo attivo, o da startingFen se non c'è nodo).
 *
 * In modalità libera le mosse finiscono in un albero TEMPORANEO (`scratch`): serve solo a navigare
 * con i pulsanti mentre si raggiunge una posizione. Non entra mai in `trees`, quindi non viene
 * salvato (IndexedDB, .mtcbook) né esportato. Si azzera entrando in un albero del documento,
 * scollegando, incollando un FEN, resettando o cambiando capitolo.
 */
export const useChessTreeStore = defineStore('chessTree', {
  state: () => ({
    trees: [] as ChessTree[],
    activeTreeId: null as string | null,
    activeNodeId: null as string | null,
    activeFen: STANDARD_FEN,
    scratch: null as ChessTree | null,   // cronologia temporanea della modalità libera (mai salvata)
    // Albero copiato o tagliato (istantanea): serve a incollarlo nello stesso capitolo o in un altro.
    // Non fa parte del documento e non viene salvato.
    clipboard: null as { mode: 'copy' | 'cut'; tree: ChessTree } | null,
    boardFlipped: false,   // scacchiera (e diagrammi inseriti) con il Nero in basso
  }),

  getters: {
    currentTree(): ChessTree | undefined {
      return this.trees.find(t => t.id === this.activeTreeId)
    },

    /** Albero su cui lavorano navigazione e registrazione: quello attivo, oppure la cronologia temporanea */
    workingTree(): ChessTree | undefined {
      return this.currentTree ?? this.scratch ?? undefined
    },

    /** Albero attivo senza mosse: la posizione iniziale è ancora modificabile */
    isCurrentTreeEmpty(): boolean {
      return !!this.currentTree && this.currentTree.rootNodes.length === 0
    },

    /** Albero attivo con mosse: la posizione iniziale è fissa */
    isFenLocked(): boolean {
      return !!this.currentTree && this.currentTree.rootNodes.length > 0
    },

    findNodeById: () => findNode,

    currentNode(): ChessMoveNode | null {
      const tree = this.workingTree
      if (!this.activeNodeId || !tree) return null
      return findNode(tree.rootNodes, this.activeNodeId)
    },

    /** Prosecuzioni dalla posizione attiva: [0] = linea principale, le altre = varianti */
    currentChildren(): ChessMoveNode[] {
      const tree = this.workingTree
      if (!tree) return []
      if (this.activeNodeId === null) return tree.rootNodes
      return this.currentNode?.children ?? []
    },

    /** Mosse alternative alla stessa altezza del nodo attivo (incluso il nodo stesso) */
    currentSiblings(): ChessMoveNode[] {
      const tree = this.workingTree
      const node = this.currentNode
      if (!tree || !node) return []
      if (node.parentId === null) return tree.rootNodes
      return findNode(tree.rootNodes, node.parentId)?.children ?? []
    },
  },

  actions: {
    toggleBoardFlip() {
      this.boardFlipped = !this.boardFlipped
    },
    
    /** Crea (senza inserirlo nello store né attivarlo) un albero che parte da `fen` */
    buildTree(title: string, fen?: string): ChessTree {
      const from = fen ?? this.activeFen   // il default va nel corpo: nei parametri `this` non è tipizzato
      return {
        id: newId('tree'),
        title,
        startingFen: isLegalFen(from) ? normalizeFen(from) : STANDARD_FEN,
        rootNodes: [],
        activeNodeId: null,
      }
    },

    /** Memorizza un'istantanea dell'albero negli appunti interni. Il taglio rimuove il blocco dal chiamante. */
    copyTree(treeId: string, mode: 'copy' | 'cut'): boolean {
      const src = this.trees.find(t => t.id === treeId)
      if (!src) return false
      this.clipboard = { mode, tree: JSON.parse(JSON.stringify(src)) as ChessTree }
      return true
    },

    /** Nuovo albero (id nuovi, non ancora nello store) a partire dagli appunti interni */
    cloneTreeFromClipboard(): ChessTree | null {
      const clip = this.clipboard
      if (!clip) return null
      const title = clip.mode === 'copy' ? `${clip.tree.title} (copia)` : clip.tree.title
      return cloneTree(clip.tree, title)
    },

    /** Duplica un albero già nello store (blocco duplicato da un incolla nativo). Restituisce il nuovo id. */
    duplicateTree(treeId: string): string | null {
      const src = this.trees.find(t => t.id === treeId)
      if (!src) return null
      const copy = cloneTree(src, `${src.title} (copia)`)
      this.trees.push(copy)
      return copy.id
    },

    /** Nuova cronologia temporanea che parte da `fen` (modalità libera) */
    startScratch(fen: string) {
      this.scratch = this.buildTree('Cronologia temporanea', fen)
      this.activeNodeId = null
    },

    /** Modalità albero: la scacchiera si porta sul nodo attivo dell'albero */
    activateTree(treeId: string): boolean {
      const tree = this.trees.find(t => t.id === treeId)
      if (!tree) return false
      this.scratch = null
      this.activeTreeId = treeId
      const saved = tree.activeNodeId
      this.setActiveNode(saved && findNode(tree.rootNodes, saved) ? saved : null)
      return true
    },

    /** Modalità libera: la posizione sulla scacchiera resta dov'è, la cronologia temporanea riparte da qui */
    deactivateTree() {
      if (this.activeTreeId === null) return   // già libera: la cronologia temporanea non si tocca
      this.activeTreeId = null
      this.activeNodeId = null
      this.scratch = null
    },

    /** Attiva l'albero e seleziona una sua mossa (click su una mossa nel documento) */
    selectNode(treeId: string, nodeId: string) {
      if (!this.trees.some(t => t.id === treeId)) return
      this.scratch = null
      this.activeTreeId = treeId
      this.setActiveNode(nodeId)
    },

    /** Naviga a un nodo dell'albero di lavoro (null = posizione iniziale). Senza albero né cronologia non fa nulla. */
    setActiveNode(nodeId: string | null) {
      const tree = this.workingTree
      if (!tree) {
        this.activeNodeId = null
        return
      }
      const node = nodeId ? findNode(tree.rootNodes, nodeId) : null
      tree.activeNodeId = node ? node.id : null
      this.activeNodeId = tree.activeNodeId
      this.activeFen = node ? node.fen : tree.startingFen
    },

    /**
     * Imposta la posizione della scacchiera da un FEN:
     * - modalità libera: posizione libera
     * - albero vuoto: posizione iniziale dell'albero
     * - albero con mosse: rifiutato ('locked')
     */
    setBoardFen(fen: string): FenResult {
      if (!isLegalFen(fen)) return 'invalid'
      const normalized = normalizeFen(fen)
      const tree = this.currentTree
      if (!tree) {
        this.scratch = null          // nuovo punto di partenza: la cronologia temporanea si azzera
        this.activeNodeId = null
        this.activeFen = normalized
        return 'ok'
      }
      if (tree.rootNodes.length > 0) return 'locked'
      tree.startingFen = normalized
      tree.activeNodeId = null
      this.activeNodeId = null
      this.activeFen = normalized
      return 'ok'
    },

    /** Libera o albero vuoto: posizione standard. Albero con mosse: nessun effetto (c'è "Inizio"). */
    resetPosition() {
      const tree = this.currentTree
      if (!tree) {
        this.scratch = null
        this.activeNodeId = null
        this.activeFen = STANDARD_FEN
        return
      }
      if (tree.rootNodes.length === 0) this.setBoardFen(STANDARD_FEN)
    },

    /** Cerca tra le prosecuzioni del nodo attivo una mossa con questa notazione */
    findChildBySan(san: string): ChessMoveNode | null {
      return this.currentChildren.find(n => n.san === san) ?? null
    },

    goToStart() {
      this.setActiveNode(null)
    },

    goBack() {
      const node = this.currentNode
      if (node) this.setActiveNode(node.parentId)
    },

    goForward(index = 0) {
      const child = this.currentChildren[index]
      if (child) this.setActiveNode(child.id)
    },

    /** Segue la linea principale a partire dalla posizione attiva fino all'ultima mossa */
    goToEnd() {
      let node = this.currentChildren[0]
      if (!node) return
      while (node.children && node.children.length > 0) node = node.children[0]
      this.setActiveNode(node.id)
    },

    /** Passa alla variante precedente (-1) o successiva (+1) alla stessa altezza */
    goToSibling(delta: 1 | -1) {
      const siblings = this.currentSiblings
      const index = siblings.findIndex(n => n.id === this.activeNodeId)
      const target = siblings[index + delta]
      if (index !== -1 && target) this.setActiveNode(target.id)
    },

    /**
     * Registra una mossa nell'albero attivo. Colore, numero e FEN si ricavano SEMPRE dal padre
     * (o da startingFen): non si può creare un nodo incoerente. SAN illegale => null.
     * Se la mossa esiste già tra i figli si naviga al nodo esistente.
     */
    addMove(san: string): { node: ChessMoveNode; isNew: boolean } | null {
      // Modalità libera: le mosse vanno nella cronologia temporanea (creata alla prima mossa,
      // e ricreata dalla posizione corrente se supera il tetto di nodi)
      if (!this.currentTree &&
          (!this.scratch || countNodes(this.scratch.rootNodes) >= SCRATCH_MAX_NODES)) {
        this.startScratch(this.activeFen)
      }

      const tree = this.workingTree
      if (!tree) return null

      const parent = this.currentNode
      if (this.activeNodeId && !parent) return null

      const chess = new Chess(parent ? parent.fen : tree.startingFen)
      const color = chess.turn()
      const moveNumber = chess.moveNumber()

      let played: ReturnType<Chess['move']>
      try {
        played = chess.move(san)
      } catch {
        return null
      }

      const siblings = parent ? parent.children : tree.rootNodes
      const existing = siblings.find(n => n.san === played.san)
      if (existing) {
        this.setActiveNode(existing.id)
        return { node: existing, isNew: false }
      }

      const node: ChessMoveNode = {
        id: newId('move'),
        san: played.san,
        fen: chess.fen(),
        moveNumber,
        color,
        parentId: parent ? parent.id : null,
        comment: null,
        children: [],
      }
      siblings.push(node)
      this.setActiveNode(node.id)
      return { node, isNew: true }
    },

    /** Elimina una mossa con tutto il suo sottoalbero e riposiziona l'albero sul padre */
    deleteBranch(nodeId: string): boolean {
      const tree = this.currentTree
      if (!tree) return false

      const target = findNode(tree.rootNodes, nodeId)
      if (!target) return false
      const siblings = target.parentId
        ? findNode(tree.rootNodes, target.parentId)?.children
        : tree.rootNodes
      if (!siblings) return false
      const index = siblings.findIndex(n => n.id === nodeId)
      if (index === -1) return false

      // Va valutato PRIMA di staccare il ramo, altrimenti il nodo attivo non si ritrova più
      const activeWasInside =
        this.activeNodeId === nodeId || this.isNodeDescendantOf(this.activeNodeId, nodeId)

      siblings.splice(index, 1)
      if (activeWasInside) this.setActiveNode(target.parentId)
      return true
    },

    isNodeDescendantOf(childId: string | null, parentId: string): boolean {
      if (!childId || !this.currentTree) return false
      let current = findNode(this.currentTree.rootNodes, childId)
      while (current && current.parentId !== null) {
        if (current.parentId === parentId) return true
        current = findNode(this.currentTree.rootNodes, current.parentId)
      }
      return false
    },

    /** Carica gli alberi di un capitolo: nessun albero attivo, posizione della scacchiera invariata */
    setChapterTrees(newTrees: ChessTree[] = []) {
      this.trees = [...newTrees]
      this.activeTreeId = null
      this.activeNodeId = null
      this.scratch = null
    },

    resetStore() {
      this.trees = []
      this.activeTreeId = null
      this.activeNodeId = null
      this.scratch = null
      this.activeFen = STANDARD_FEN
    },

    setShowHeader(treeId: string, value: boolean) {
      const tree = this.trees.find(t => t.id === treeId)
      if (tree) tree.showHeader = value
    },

    updateNodeComment(nodeId: string, comment: string | null) {
      if (!this.currentTree) return
      const node = findNode(this.currentTree.rootNodes, nodeId)
      if (node) node.comment = comment === '' ? null : comment
    },

    /** Il nodo appartiene alla linea principale? (children[0] è sempre la mainline) */
    isNodeInMainline(rootNodes: ChessMoveNode[], targetNodeId: string): boolean {
      let current: ChessMoveNode | undefined = rootNodes?.[0]
      while (current) {
        if (current.id === targetNodeId) return true
        current = current.children?.length ? current.children[0] : undefined
      }
      return false
    },

    /**
     * Spezza l'albero nel punto indicato (solo su mainline): le mosse successive diventano
     * un nuovo albero che parte dalla FEN del nodo.
     */
    splitTree(treeId: string, nodeId: string): string | null {
      const sourceTree = this.trees.find(t => t.id === treeId)
      if (!sourceTree) return null
      if (!this.isNodeInMainline(sourceTree.rootNodes, nodeId)) return null

      const splitNode = findNode(sourceTree.rootNodes, nodeId)
      if (!splitNode || splitNode.children.length === 0) return null

      const detachedChildren = [...splitNode.children]
      splitNode.children = []
      detachedChildren.forEach(child => { child.parentId = null })

      const newTree: ChessTree = {
        id: newId('tree'),
        title: `${sourceTree.title} (Cont.)`,
        startingFen: splitNode.fen,
        rootNodes: detachedChildren,
        activeNodeId: null,
        parentTreeId: sourceTree.id,
        splitAtNodeId: nodeId,
      }
      this.trees.push(newTree)
      return newTree.id
    },

    /** Rimuove gli alberi non presenti nel capitolo (chiamata al salvataggio) */
    cleanOrphanTrees(activeTreeIds: string[]) {
      const keep = new Set(activeTreeIds)
      this.trees = this.trees.filter(t => keep.has(t.id))
      if (this.activeTreeId && !keep.has(this.activeTreeId)) this.deactivateTree()
    },
  },
})
