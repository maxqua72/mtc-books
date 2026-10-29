import { defineStore } from 'pinia'
import { Chess } from 'chess.js'
import { STANDARD_FEN, isLegalFen, normalizeFen } from '../utils/fen'
import { toggleNagInList } from '../utils/nags'
import type { BoardShape } from '../utils/shapes'
import { newId } from '../utils/ids'
import {
  findNode, cloneTree, countNodes, splitPoints, variationDepth, canMergeInto, printedEnd, renumberFrom,
  promoteTarget, demoteTarget, moveSibling, makeMainLine, reorderBlockedReason
} from '../utils/treeOps'

export interface ChessMoveNode {
  id: string
  san: string
  fen: string
  moveNumber: number
  color: 'w' | 'b'
  parentId: string | null
  comment: string | null
  nags?: number[]          // simboli di annotazione PGN (1 = !, 2 = ?, ...)
  shapes?: BoardShape[]    // frecce e marcatori di casella disegnati su questa posizione
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
  depthStart?: number        // parentesi già aperte all'inizio del blocco (continuazione di una variante)
  closeParens?: number       // parentesi da chiudere alla fine del blocco
  endNodeId?: string | null  // ultima mossa del blocco, se il testo continua nei blocchi successivi
  openCount?: number         // quante varianti (le più esterne verso endNodeId) restano aperte
}

export type FenResult = 'ok' | 'invalid' | 'locked'

/** ok = riordinato; noop = niente da spostare; blocked = albero diviso in più blocchi */
export type ReorderResult = 'ok' | 'noop' | 'blocked'

/** Stato dei comandi di riordino per la mossa attiva (usato da console e tooltip) */
export interface VariationMoves {
  blocked: string | null           // motivo per cui il riordino è vietato, se lo è
  promote: ChessMoveNode | null    // radice della linea che salirebbe di un posto (e di «Rendi principale»)
  demote: ChessMoveNode | null     // radice della linea che scenderebbe di un posto
}

// Tetto di nodi della cronologia temporanea: oltre, riparte dalla posizione corrente
const SCRATCH_MAX_NODES = 2000

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

    /** Cosa possono fare Promuovi / Rendi principale / Abbassa con la mossa attiva */
    variationMoves(): VariationMoves {
      const tree = this.currentTree
      if (!tree || !this.activeNodeId) return { blocked: null, promote: null, demote: null }
      return {
        blocked: reorderBlockedReason(tree, this.trees),
        promote: promoteTarget(tree.rootNodes, this.activeNodeId)?.node ?? null,
        demote: demoteTarget(tree.rootNodes, this.activeNodeId)?.node ?? null,
      }
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

    /** Aggiunge/toglie un simbolo di annotazione (!, ?, +=, ...) a una mossa. I gruppi esclusivi si sostituiscono. */
    toggleNag(nodeId: string, nag: number) {
      const tree = this.workingTree
      const node = tree ? findNode(tree.rootNodes, nodeId) : null
      if (!node) return
      const next = toggleNagInList(node.nags ?? [], nag)
      if (next.length) node.nags = next
      else delete node.nags
    },

    /** Frecce e marcatori della posizione attiva (senza mossa attiva restano solo sulla scacchiera) */
    setNodeShapes(shapes: BoardShape[]) {
      const node = this.currentNode
      if (!node) return
      if (shapes.length) node.shapes = shapes.map(s => ({ ...s }))
      else delete node.shapes
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

    /** La linea della mossa attiva sale di un posto tra le alternative (la prima diventa principale) */
    promoteVariation(): ReorderResult {
      const tree = this.currentTree
      if (!tree || !this.activeNodeId) return 'noop'
      if (reorderBlockedReason(tree, this.trees)) return 'blocked'
      const loc = promoteTarget(tree.rootNodes, this.activeNodeId)
      return loc && moveSibling(loc, -1) ? 'ok' : 'noop'
    },

    /** La linea della mossa attiva scende di un posto (la principale diventa variante) */
    demoteVariation(): ReorderResult {
      const tree = this.currentTree
      if (!tree || !this.activeNodeId) return 'noop'
      if (reorderBlockedReason(tree, this.trees)) return 'blocked'
      const loc = demoteTarget(tree.rootNodes, this.activeNodeId)
      return loc && moveSibling(loc, 1) ? 'ok' : 'noop'
    },

    /** La linea della mossa attiva diventa principale a ogni livello di annidamento */
    makeMainLine(): ReorderResult {
      const tree = this.currentTree
      if (!tree || !this.activeNodeId) return 'noop'
      if (reorderBlockedReason(tree, this.trees)) return 'blocked'
      return makeMainLine(tree.rootNodes, this.activeNodeId) > 0 ? 'ok' : 'noop'
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
 * Spezza l'albero dopo la mossa indicata, anche in una variante (vedi splitPoints).
 * Ogni blocco derivato riceve il livello di parentesi da cui parte (depthStart) e quante ne chiude (closeParens);
 * il primo blocco lascia aperte le varianti che continuano nei blocchi successivi (endNodeId + openCount).
 * Restituisce gli id dei nuovi alberi, nell'ordine di stampa.
 */
    splitTree(treeId: string, nodeId: string): string[] | null {
      const source = this.trees.find(t => t.id === treeId)
      // Un blocco con parentesi lasciate aperte non si divide di nuovo: l'ordine di stampa non tornerebbe
      if (!source || source.endNodeId) return null
      const points = splitPoints(source.rootNodes, nodeId)
      if (points.length === 0) return null

      const baseDepth = source.depthStart ?? 0
      const depths = points.map(p => variationDepth(source.rootNodes, p.id))   // prima di staccare i nodi
      // La coda del testo originale finisce nell'ultimo blocco: gli passa anche le chiusure che aveva il sorgente
      const lastClose = depths[depths.length - 1] + (source.closeParens ?? 0)

      const created = points.map((point, i): ChessTree => {
        const roots = point.children
        point.children = []
        roots.forEach(r => { r.parentId = null })
        const depthStart = baseDepth + depths[i]
        const closeParens = i < points.length - 1 ? depths[i] - depths[i + 1] : lastClose
        return {
          id: newId('tree'),
          title: `${source.title} (Cont.${points.length > 1 ? ` ${i + 1}` : ''})`,
          startingFen: point.fen,
          rootNodes: roots,
          activeNodeId: null,
          parentTreeId: source.id,
          splitAtNodeId: point.id,
          ...(depthStart ? { depthStart } : {}),
          ...(closeParens ? { closeParens } : {}),
        }
      })
      this.trees.push(...created)

      // Il primo blocco finisce in T: le varianti che la contengono restano aperte
      delete source.closeParens
      if (depths[0] > 0) {
        source.endNodeId = nodeId
        source.openCount = depths[0]
      }

      if (this.activeTreeId === treeId) this.setActiveNode(nodeId)
      else if (source.activeNodeId && !findNode(source.rootNodes, source.activeNodeId)) source.activeNodeId = nodeId
      return created.map(t => t.id)
    },

        /**
     * Unisce B ad A: i nodi di B si riattaccano sotto l'ultima mossa stampata da A e B sparisce.
     * Le parentesi si ricalcolano: parte di quelle che A lasciava aperte può chiudersi qui,
     * il resto resta aperto per il blocco successivo.
     */
    mergeTrees(aId: string, bId: string): boolean {
      const a = this.trees.find(t => t.id === aId)
      const b = this.trees.find(t => t.id === bId)
      if (!a || !b || !canMergeInto(a, b)) return false
      const end = printedEnd(a)
      if (!end) return false

      const k = variationDepth(a.rootNodes, end.id)   // varianti che A lasciava aperte
      const wasActiveB = this.activeTreeId === b.id
      const activeInB = wasActiveB ? this.activeNodeId : null

      // Alberi indipendenti: i contatori di B possono differire da quelli di A
      if (end.fen !== b.startingFen) renumberFrom(end.fen, b.rootNodes)

      end.children = b.rootNodes
      b.rootNodes.forEach(r => { r.parentId = end.id })

      if (b.endNodeId) {
        a.endNodeId = b.endNodeId
        a.openCount = k + (b.openCount ?? 0)
        delete a.closeParens
      } else {
        const rest = k - (b.closeParens ?? 0)
        if (rest > 0) {
          a.endNodeId = end.id
          a.openCount = rest
          delete a.closeParens
        } else {
          delete a.endNodeId
          delete a.openCount
          if (rest < 0) a.closeParens = -rest
          else delete a.closeParens
        }
      }

      this.trees.forEach(t => { if (t.parentTreeId === b.id) t.parentTreeId = a.id })
      this.trees = this.trees.filter(t => t.id !== b.id)

      if (wasActiveB) {
        this.activeTreeId = a.id
        this.setActiveNode(activeInB)
      }
      return true
    },

    /** Rimuove gli alberi non presenti nel capitolo (chiamata al salvataggio) */
    cleanOrphanTrees(activeTreeIds: string[]) {
      const keep = new Set(activeTreeIds)
      this.trees = this.trees.filter(t => keep.has(t.id))
      if (this.activeTreeId && !keep.has(this.activeTreeId)) this.deactivateTree()
    },
  },
})