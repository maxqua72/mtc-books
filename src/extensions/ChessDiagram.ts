import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { fenToBoardString } from '../utils/chessFormatter.ts'
import ChessDiagramNode from '../components/ChessDiagramNode.vue'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chessDiagram: {
      insertChessDiagram: (attributes: { fen: string }) => ReturnType
    }
  }
}

export const ChessDiagram = Node.create({
  name: 'chessDiagram',
  group: 'block',
  content: 'inline*', // Permette alla didascalia di contenere testo formattato inline
  defining: true,

  addAttributes() {
    return {
      fen: {
        default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      },
      size: {
        default: null, // Se è null, userà la dimensione globale dello store
      },
      captionEditable: {
        default: true, // Di default la didascalia è attiva/editabile
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="chess-diagram"]',
        // 'contentElement' dice a Tiptap di estrarre e parsare come contenuto del nodo 
        // SOLO quello che si trova dentro '.diagram-caption', ignorando il <pre> della scacchiera!
        contentElement: '.diagram-caption',
      },
    ]
  },

  /**
   * Genera l'HTML statico per Tiptap (usato durante .getHTML() e l'esportazione PDF).
   * Costruisce la scacchiera testuale in formato font direttamente dentro la struttura HTML.
   */
  renderHTML({ HTMLAttributes }) {
    const fen = HTMLAttributes.fen || ''
    const boardText = fenToBoardString(fen)
    
    // Determina a chi spetta la mossa ('white' o 'black')
    const fenParts = fen.trim().split(/\s+/)
    const turnClass = fenParts[1] === 'b' ? 'black' : 'white'

    return [
      'div',
      mergeAttributes(HTMLAttributes, { 
        'data-type': 'chess-diagram',
        class: 'chess-diagram-container avoid-break' 
      }),
      [
        'div',
        { class: 'diagram-card' },
        [
          'div',
          { class: 'board-wrapper' },
          [
            'div', 
            { class: 'diagram-number-badge', title: 'Numero diagramma' },
            ['div', { class: 'badge-text' }] // Verrà popolato o stilizzato via CSS
          ],
          ['div', { class: `turn-indicator ${turnClass}` }],
          ['pre', { class: 'chess-pure-text' }, boardText]
        ],
        // Il numero 0 indica il punto di inserimento per il contenuto del nodo (la didascalia)
        ['div', { class: 'diagram-caption' }, 0]
      ]
    ]
  },

  /**
   * Utilizza il componente Vue per l'esperienza interattiva all'interno dell'editor.
   */
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
            content: [{ type: 'text', text: 'Posizione dopo la mossa.' }]
          })
          .run()
      },
    }
  },
})