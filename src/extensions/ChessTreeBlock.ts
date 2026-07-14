import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
// CORREZIONE: Importa il componente come default export, senza l'asterisco *
import ChessTreeBlockView from '../components/ChessTreeBlockView.vue'

export const ChessTreeBlock = Node.create({
  name: 'chessTreeBlock',
  group: 'block',
  atom: true, // Impedisce a Tiptap di far entrare il cursore all'interno del blocco come testo normale

  addAttributes() {
    return {
      treeId: {
        default: null,
        parseHTML: element => element.getAttribute('tree-id'),
        renderHTML: attributes => {
          if (!attributes.treeId) return {}
          return { 'tree-id': attributes.treeId }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'chess-tree-block',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['chess-tree-block', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    // Ora riceve il componente corretto e VueNodeViewRenderer saprà come montarlo
    return VueNodeViewRenderer(ChessTreeBlockView)
  },
})