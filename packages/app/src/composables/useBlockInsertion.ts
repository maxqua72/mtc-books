// Inserimento di diagrammi e blocchi albero nel documento
import { watch, type ShallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { usePgnImportStore } from '../stores/pgnImportStore'
import { findTreeBlockPos, treeIdsInDoc } from '../utils/editorDoc'
import { canSplitAt, findMergeableChild } from '../utils/treeOps'
import { resetHistory } from '../utils/editorHistory'
import { NodeSelection } from '@tiptap/pm/state'
import { isContentSection } from '../utils/sectionOrder'

type EditorRef = ShallowRef<Editor | undefined>

const SPLIT_CONFIRM =
  'Il blocco verrà diviso in questo punto. L’operazione non è annullabile: la cronologia di annulla/ripristina dell’editor verrà azzerata. Continuare?'
const MERGE_CONFIRM =
  'I due blocchi verranno uniti in uno solo. L’operazione non è annullabile: la cronologia di annulla/ripristina dell’editor verrà azzerata. Continuare?'

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

  // Toolbar: nuovo albero dopo il paragrafo del cursore, che parte dalla posizione corrente della scacchiera
  const insertNewChessTreeBlock = () => {
    if (!editor.value || !isContentSection(store.activeSectionInfo?.type)) return
    const tree = treeStore.buildTree(`Albero #${treeStore.trees.length + 1}`)
    pgnStore.addTrees([tree], 'cursor')
  }

  /**
   * Spezza l'albero in `nodeId` e inserisce, subito dopo il blocco, il diagramma (se c'è) e i nuovi blocchi.
   * Non entra nella cronologia di ProseMirror, che viene azzerata: Ctrl+Z non può lasciare
   * il primo blocco troncato con gli altri spariti.
   */
  const splitAndInsert = (ed: Editor, treeId: string, nodeId: string, diagram?: object): boolean => {
    const block = findTreeBlockPos(ed.state.doc, treeId)
    if (!block) return false
    const newIds = treeStore.splitTree(treeId, nodeId)
    if (!newIds) return false

    ed.chain().focus().insertContentAt(block.pos + block.size, [
      ...(diagram ? [diagram] : []),
      ...newIds.map(id => ({ type: 'chessTreeBlock', attrs: { treeId: id } })),
      { type: 'paragraph' } // riga vuota per continuare a scrivere
    ]).setMeta('addToHistory', false).run()

    resetHistory(ed)
    store.activeSectionHtml = ed.getHTML()
    return true
  }

  // Toolbar "Dividi Blocco": taglio dopo la mossa selezionata (linea principale o variante), senza diagramma
  const handleSplitTreeBlock = () => {
    const ed = editor.value
    const tree = treeStore.currentTree
    const nodeId = treeStore.activeNodeId
    if (!ed || !tree || !nodeId || store.isLocked) return
    if (!canSplitAt(tree, nodeId)) return
    if (!confirm(SPLIT_CONFIRM)) return
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

  // "Inserisci Diagramma" dalla console: la posizione è sempre treeStore.activeFen
  watch(() => store.insertSignal, () => {
    const ed = editor.value
    if (!ed || !isContentSection(store.activeSectionInfo?.type)) return

    try {
      const diagramFen = treeStore.activeFen
      const diagramShapes = [...store.activeShapes]
      const tree = treeStore.currentTree
      const block = tree ? findTreeBlockPos(ed.state.doc, tree.id) : null

      // Modalità libera: al cursore, senza toccare alberi
      if (!tree || !block) {
        const { selection } = ed.state
        const pos = selection instanceof NodeSelection || selection.$to.depth === 0
          ? selection.to                 // nodo selezionato (es. un diagramma): subito dopo
          : selection.$to.after(1)       // altrimenti: dopo il blocco di primo livello del cursore
        ed.chain().focus().insertContentAt(pos, [
          { type: 'chessDiagram', attrs: { fen: diagramFen, flipped: treeStore.boardFlipped, shapes: diagramShapes.length ? diagramShapes : null } },
          { type: 'paragraph' }
        ]).run()
        return
      }

      const diagram = {
        type: 'chessDiagram',
        attrs: { fen: diagramFen, flipped: treeStore.boardFlipped, shapes: diagramShapes.length ? diagramShapes : null }
      }
      const node = treeStore.currentNode

      // Posizione iniziale di un albero con mosse: il diagramma precede il blocco
      if (tree.rootNodes.length > 0 && !node) {
        ed.chain().focus().insertContentAt(block.pos, [diagram]).run()
        return
      }

      // Dopo la mossa selezionata c'è ancora qualcosa da stampare: l'albero si spezza lì
      if (node && canSplitAt(tree, node.id)) {
        if (!confirm(SPLIT_CONFIRM)) return
        splitAndInsert(ed, tree.id, node.id, diagram)
        return
      }

      // Albero vuoto o niente da stampare dopo la mossa: dopo il blocco, albero intatto
      ed.chain().focus().insertContentAt(block.pos + block.size, [diagram, { type: 'paragraph' }]).run()
    } catch (error) {
      console.error('Errore durante l\'inserimento del diagramma:', error)
    }
  })

  return { insertNewChessTreeBlock, handleSplitTreeBlock, handleMergeTreeBlock }
}