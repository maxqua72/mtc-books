import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ChessDiagramNode from '../components/ChessDiagramNode.vue'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chessDiagram: {
      insertChessDiagram: (attributes: { fen: string }) => ReturnType,
    }
  }
}

export const ChessDiagram = Node.create({
  name: 'chessDiagram',
  group: 'block',
  content: 'inline*', // Permette al tag di didascalia inferiore di contenere testo
  defining: true,

  addAttributes() {
    return {
      fen: {
        default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      },
      size: {
        default: null, // Se è null, userà la dimensione globale dello store
      },
      // <--- NUOVO ATTRIBUTO per editare la didascalia --->
      captionEditable: {
        default: true, // Di default la didascalia è attiva/editabile
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="chess-diagram"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'chess-diagram' }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(ChessDiagramNode)
  },

  addCommands() {
    return {
      insertChessDiagram: (options) => ({ chain }) => {
        return chain()
          .insertContent({
            type: this.name,
            attrs: { fen: options.fen },
            content: [{ type: 'text', text: 'Posizione dopo la mossa.' }] // Testo predefinito della didascalia
          })
          .run()
      },
    }
  },
})