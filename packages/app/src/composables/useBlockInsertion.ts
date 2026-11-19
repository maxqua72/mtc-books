// Inserimento di diagrammi e blocchi albero nel documento
import { watch, type ShallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import type { Node as PMNode } from '@tiptap/pm/model'
import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { usePgnImportStore } from '../stores/pgnImportStore'
import { useNoticeStore } from '../stores/noticeStore'
import { findTreeBlockPos, treeIdsInDoc } from '../utils/editorDoc'
import { canSplitAt, findMergeableChild } from '../utils/treeOps'
import { resetHistory } from '../utils/editorHistory'
import { NodeSelection } from '@tiptap/pm/state'
import { isContentSection } from '../utils/sectionOrder'
import { nodeLabel } from '../utils/pgnImport'

type EditorRef = ShallowRef<Editor | undefined>

const MERGE_CONFIRM =
  'I due blocchi verranno uniti in uno solo. L’operazione non è annullabile: la cronologia di annulla/ripristina dell’editor verrà azzerata. Continuare?'
const HISTORY_NOTE = 'Ctrl+Z non torna alle modifiche precedenti.'

// Un secondo clic su «Inserisci Diagramma» entro questo tempo è un doppio clic: non inserisce un altro diagramma
const REPEAT_GUARD_MS = 600

/** Dove finisce un diagramma inserito ora (stesse regole per l'inserimento e per l'anteprima) */
export type DiagramTarget =
  | { kind: 'free'; pos: number }                    // nessun albero attivo: dopo il blocco del cursore
  | { kind: 'before'; pos: number }                  // posizione iniziale di un albero con mosse: prima del blocco
  | { kind: 'split'; pos: number; treeId: string; nodeId: string }   // il blocco si divide dopo la mossa
  | { kind: 'after'; pos: number }                   // niente da stampare dopo la mossa: dopo il blocco

/** Calcola la destinazione del diagramma; null se non si può inserire (nessun editor) */
export function resolveDiagramTarget(ed: Editor): DiagramTarget | null {
  const treeStore = useChessTreeStore()
  const tree = treeStore.currentTree
  const block = tree ? findTreeBlockPos(ed.state.doc, tree.id) : null

  if (!tree || !block) {
    const { selection } = ed.state
    const pos = selection instanceof NodeSelection || selection.$to.depth === 0
      ? selection.to                 // nodo selezionato (es. un diagramma): subito dopo
      : selection.$to.after(1)       // altrimenti: dopo il blocco di primo livello del cursore
    return { kind: 'free', pos }
  }

  const node = treeStore.currentNode
  if (tree.rootNodes.length > 0 && !node) return { kind: 'before', pos: block.pos }
  if (node && canSplitAt(tree, node.id)) {
    return { kind: 'split', pos: block.pos + block.size, treeId: tree.id, nodeId: node.id }
  }
  return { kind: 'after', pos: block.pos + block.size }
}

/** true se il blocco di primo livello che inizia in `pos` è un paragrafo vuoto */
const emptyParagraphAt = (doc: PMNode, pos: number): boolean => {
  const next = pos < doc.content.size ? doc.nodeAt(pos) : null
  return !!next && next.type.name === 'paragraph' && next.content.size === 0
}

/**
 * Inserisce `content` in `pos` seguito da un paragrafo per continuare a scrivere; se lì c'è già un paragrafo
 * vuoto si usa quello (niente paragrafi vuoti accumulati). Il cursore finisce nel paragrafo.
 * Restituisce true se il paragrafo è stato aggiunto.
 */
const insertWithParagraph = (ed: Editor, pos: number, content: object[], outsideHistory = false): boolean => {
  const reuse = emptyParagraphAt(ed.state.doc, pos)
  const before = ed.state.doc.content.size
  ed.chain().focus().insertContentAt(pos, [...content, ...(reuse ? [] : [{ type: 'paragraph' }])])
    .setMeta('addToHistory', !outsideHistory).run()
  if (reuse) ed.commands.setTextSelection(pos + (ed.state.doc.content.size - before) + 1)
  return !reuse
}

/** Posizione del diagramma con quell'id (null se non c'è più) */
const findDiagramPos = (doc: PMNode, id: string): { pos: number; size: number } | null => {
  let found: { pos: number; size: number } | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name === 'chessDiagram' && node.attrs.id === id) {
      found = { pos, size: node.nodeSize }
      return false
    }
  })
  return found
}

/** Incolla l'albero copiato o tagliato (anche da un altro capitolo): nuovo albero indipendente, nel punto del cursore */
export function pasteTreeFromClipboard() {
  const store = useChessBookStore()
  if (!isContentSection(store.activeSectionInfo?.type)) return
  const tree = useChessTreeStore().cloneTreeFromClipboard()
  if (!tree) return
  usePgnImportStore().addTrees([tree], 'cursor')
}

export function useBlockInsertion(editor: EditorRef) {
  const store = useChessBookStore()
  const treeStore = useChessTreeStore()
  const pgnStore = usePgnImportStore()
  const notices = useNoticeStore()

  // Toolbar: nuovo albero dopo il paragrafo del cursore, che parte dalla posizione corrente della scacchiera
  const insertNewChessTreeBlock = () => {
    if (!editor.value || !isContentSection(store.activeSectionInfo?.type)) return
    const tree = treeStore.buildTree(`Albero #${treeStore.trees.length + 1}`)
    pgnStore.addTrees([tree], 'cursor')
  }

  /**
   * Riunisce in `sourceId` i blocchi derivati `derivedIds` (in ordine di stampa) e toglie il diagramma `diagramId`.
   * Si ferma al primo blocco che non si può più unire (ad esempio perché l'utente l'ha già spostato o unito).
   * `addedParagraph`: la divisione aveva aggiunto il paragrafo dopo i blocchi; se è ancora vuoto si toglie.
   */
  const undoSplit = (sourceId: string, derivedIds: string[], diagramId: string | null, addedParagraph: boolean) => {
    const ed = editor.value
    if (!ed || store.isLocked) return
    const source = treeStore.trees.find(t => t.id === sourceId)
    if (!source || !findTreeBlockPos(ed.state.doc, sourceId)) return

    let merged = 0
    for (;;) {
      const b = findMergeableChild(source, treeStore.trees, treeIdsInDoc(ed.state.doc))
      if (!b || !derivedIds.includes(b.id)) break
      const blockB = findTreeBlockPos(ed.state.doc, b.id)
      if (!blockB) break
      ed.chain().deleteRange({ from: blockB.pos, to: blockB.pos + blockB.size })
        .setMeta('addToHistory', false).run()
      if (!treeStore.mergeTrees(sourceId, b.id)) break
      merged++
    }

    const diagram = diagramId ? findDiagramPos(ed.state.doc, diagramId) : null
    if (diagram) {
      ed.chain().deleteRange({ from: diagram.pos, to: diagram.pos + diagram.size })
        .setMeta('addToHistory', false).run()
    }
    if (!merged && !diagram) return

    // Tutto riunito: il paragrafo vuoto aggiunto dalla divisione, ora subito dopo il blocco, non serve più
    const block = findTreeBlockPos(ed.state.doc, sourceId)
    if (addedParagraph && block && merged === derivedIds.length && emptyParagraphAt(ed.state.doc, block.pos + block.size)) {
      const at = block.pos + block.size
      ed.chain().deleteRange({ from: at, to: at + 2 }).setMeta('addToHistory', false).run()
    }
    resetHistory(ed)
    store.activeSectionHtml = ed.getHTML()
  }

  /**
   * Spezza l'albero in `nodeId` e inserisce, subito dopo il blocco, il diagramma (se c'è) e i nuovi blocchi.
   * Non entra nella cronologia di ProseMirror, che viene azzerata: Ctrl+Z non può lasciare
   * il primo blocco troncato con gli altri spariti. Al suo posto l'avviso offre «Annulla».
   */
  const splitAndInsert = (ed: Editor, treeId: string, nodeId: string, diagram?: object): boolean => {
    const block = findTreeBlockPos(ed.state.doc, treeId)
    if (!block) return false
    const newIds = treeStore.splitTree(treeId, nodeId)
    if (!newIds) return false

    const at = block.pos + block.size
    const addedParagraph = insertWithParagraph(ed, at, [
      ...(diagram ? [diagram] : []),
      ...newIds.map(id => ({ type: 'chessTreeBlock', attrs: { treeId: id } })),
    ], true)

    // L'id del diagramma lo assegna un plugin durante l'inserimento: si legge dal documento
    const inserted = diagram ? ed.state.doc.nodeAt(at) : null
    const diagramId: string | null = inserted?.type.name === 'chessDiagram' ? inserted.attrs.id ?? null : null

    resetHistory(ed)
    store.activeSectionHtml = ed.getHTML()

    notices.show({
      message: newIds.length > 1 ? `Blocco diviso in ${newIds.length + 1} parti` : 'Blocco diviso in due',
      detail: HISTORY_NOTE,
      action: { label: 'Annulla', run: () => undoSplit(treeId, newIds, diagramId, addedParagraph) },
    })
    return true
  }

  // Toolbar "Dividi Blocco": taglio dopo la mossa selezionata (linea principale o variante), senza diagramma
  const handleSplitTreeBlock = () => {
    const ed = editor.value
    const tree = treeStore.currentTree
    const nodeId = treeStore.activeNodeId
    if (!ed || !tree || !nodeId || store.isLocked) return
    if (!canSplitAt(tree, nodeId)) return
    splitAndInsert(ed, tree.id, nodeId)
  }

  // Toolbar "Unisci Blocchi": il blocco attivo assorbe il blocco che lo continua
  const handleMergeTreeBlock = () => {
    const ed = editor.value
    const a = treeStore.currentTree
    if (!ed || !a || store.isLocked) return
    const b = findMergeableChild(a, treeStore.trees, treeIdsInDoc(ed.state.doc))
    if (!b) return
    const blockB = findTreeBlockPos(ed.state.doc, b.id)
    if (!blockB) return
    if (!confirm(MERGE_CONFIRM)) return

    ed.chain().deleteRange({ from: blockB.pos, to: blockB.pos + blockB.size })
      .setMeta('addToHistory', false).run()
    if (!treeStore.mergeTrees(a.id, b.id)) return
    resetHistory(ed)
    store.activeSectionHtml = ed.getHTML()
  }

  // Anteprima: con il mouse su «Inserisci Diagramma» un riquadro mostra dove finirà il diagramma
  watch(() => store.diagramPreview, (on) => {
    const ed = editor.value
    if (!ed) return
    const target = on && isContentSection(store.activeSectionInfo?.type) && !store.isLocked
      ? resolveDiagramTarget(ed) : null
    // Nella divisione il riquadro sta dopo il blocco, ma il diagramma va dopo la mossa: il testo la nomina
    const node = target?.kind === 'split' ? treeStore.currentNode : null
    ed.commands.setInsertMarker(target?.pos ?? null, node
      ? `Il diagramma andrà dopo ${nodeLabel(node)}: il blocco verrà diviso in quel punto`
      : 'Il diagramma andrà qui')
  })

  // "Inserisci Diagramma" dalla console: la posizione è sempre treeStore.activeFen
  let lastInsertAt = 0
  watch(() => store.insertSignal, () => {
    const ed = editor.value
    if (!ed || !isContentSection(store.activeSectionInfo?.type)) return

    const now = Date.now()
    if (now - lastInsertAt < REPEAT_GUARD_MS) return
    lastInsertAt = now
    store.diagramPreview = false   // il riquadro dell'anteprima non deve restare sul diagramma appena inserito

    try {
      const diagramShapes = [...store.activeShapes]
      const diagram = {
        type: 'chessDiagram',
        attrs: { fen: treeStore.activeFen, flipped: treeStore.boardFlipped, shapes: diagramShapes.length ? diagramShapes : null }
      }
      const target = resolveDiagramTarget(ed)
      if (!target) return

      switch (target.kind) {
        case 'split':
          splitAndInsert(ed, target.treeId, target.nodeId, diagram)
          return
        case 'before':
          // Posizione iniziale di un albero con mosse: il diagramma precede il blocco
          ed.chain().focus().insertContentAt(target.pos, [diagram]).run()
          return
        default:
          // Modalità libera, oppure albero vuoto / niente da stampare dopo la mossa: albero intatto
          insertWithParagraph(ed, target.pos, [diagram])
      }
    } catch (error) {
      console.error('Errore durante l\'inserimento del diagramma:', error)
    }
  })

  return { insertNewChessTreeBlock, handleSplitTreeBlock, handleMergeTreeBlock }
}
