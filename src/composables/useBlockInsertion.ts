// Inserimento di diagrammi e blocchi albero nel documento
import { watch, type ShallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { usePgnImportStore } from '../stores/pgnImportStore'
import { findTreeBlockPos } from '../utils/editorDoc'

type EditorRef = ShallowRef<Editor | undefined>

/** Incolla l'albero copiato o tagliato (anche da un altro capitolo): nuovo albero indipendente, nel punto del cursore */
export function pasteTreeFromClipboard() {
  const store = useChessBookStore()
  if (store.activeSectionInfo?.type !== 'chapter') return
  const tree = useChessTreeStore().cloneTreeFromClipboard()
  if (!tree) return
  usePgnImportStore().addTrees([tree], 'cursor')
}

export function useBlockInsertion(editor: EditorRef) {
  const store = useChessBookStore()
  const treeStore = useChessTreeStore()
  const pgnStore = usePgnImportStore()

  // Toolbar: nuovo albero in fondo al capitolo, che parte dalla posizione corrente della scacchiera
  const insertNewChessTreeBlock = () => {
    if (!editor.value || store.activeSectionInfo?.type !== 'chapter') return
    const tree = treeStore.buildTree(`Albero #${treeStore.trees.length + 1}`)
    pgnStore.addTrees([tree], 'end')
  }

  // Toolbar "Dividi Blocco": spezza l'albero attivo nella mossa selezionata e inserisce il secondo blocco
  const handleSplitTreeBlock = () => {
    const ed = editor.value
    const currentTreeId = treeStore.activeTreeId
    const activeNodeId = treeStore.activeNodeId
    if (!ed || !currentTreeId || !activeNodeId) return

    const newTreeId = treeStore.splitTree(currentTreeId, activeNodeId)
    if (!newTreeId) return

    const block = findTreeBlockPos(ed.state.doc, currentTreeId)
    if (!block) return

    ed.chain()
      .setTextSelection(block.pos + block.size)
      .insertContent([
        { type: 'chessTreeBlock', attrs: { treeId: newTreeId } },
        { type: 'paragraph' } // riga vuota per continuare a scrivere
      ])
      .run()

    store.activeSectionHtml = ed.getHTML()
  }

  // "Inserisci Diagramma" dalla console: la posizione è sempre treeStore.activeFen; dove va nel documento dipende dalla modalità
  watch(() => store.insertSignal, () => {
    const ed = editor.value
    if (!ed || store.activeSectionInfo?.type !== 'chapter') return

    try {
      const diagramFen = treeStore.activeFen
      const diagramShapes = [...store.activeShapes]
      const tree = treeStore.currentTree
      const block = tree ? findTreeBlockPos(ed.state.doc, tree.id) : null

      // Modalità libera: al cursore, senza toccare alberi
      if (!tree || !block) {
        ed.chain().focus()
          .insertChessDiagram({ fen: diagramFen, flipped: treeStore.boardFlipped, shapes: diagramShapes })
          .insertContent({ type: 'paragraph' }).run()
        return
      }

      const diagram = {
        type: 'chessDiagram',
        attrs: { fen: diagramFen, flipped: treeStore.boardFlipped, shapes: diagramShapes.length ? diagramShapes : null }
      }
      const paragraph = { type: 'paragraph' }
      const afterBlock = block.pos + block.size
      const node = treeStore.currentNode

      // Posizione iniziale di un albero con mosse: il diagramma precede il blocco
      if (tree.rootNodes.length > 0 && !node) {
        ed.chain().focus().insertContentAt(block.pos, [diagram]).run()
        return
      }

      // Mossa in linea principale con mosse successive: si spezza l'albero in due
      if (node && node.children.length > 0 && treeStore.isNodeInMainline(tree.rootNodes, node.id)) {
        const newTreeId = treeStore.splitTree(tree.id, node.id)
        if (newTreeId) {
          ed.chain().focus().insertContentAt(afterBlock, [
            diagram,
            { type: 'chessTreeBlock', attrs: { treeId: newTreeId } },
            paragraph
          ]).run()
          return
        }
      }

      // Albero vuoto, ultima mossa o mossa in una variante: dopo il blocco, albero intatto
      ed.chain().focus().insertContentAt(afterBlock, [diagram, paragraph]).run()
    } catch (error) {
      console.error('Errore durante l\'inserimento del diagramma:', error)
    }
  })

  return { insertNewChessTreeBlock, handleSplitTreeBlock }
}
