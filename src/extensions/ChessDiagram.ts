import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
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

const generateDiagramId = () =>
  'dg_' + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))

export const ChessDiagram = Node.create({
  name: 'chessDiagram',
  group: 'block',
  content: 'inline*', // Permette alla didascalia di contenere testo formattato inline
  defining: true,

  addAttributes() {
    return {
      // Identificativo stabile: serve ai riferimenti nel testo
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => (attributes.id ? { 'data-id': attributes.id } : {}),
      },
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

  // Assegna un ID ai diagrammi che non ce l'hanno (nuovi o di libri precedenti)
  // e rigenera quello dei duplicati (copia/incolla). Tagliare e incollare conserva l'ID.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('chessDiagramUniqueId'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some(tr => tr.docChanged)) return null

          const seen = new Set<string>()
          const tr = newState.tr
          let modified = false

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== this.name) return
            const id = node.attrs.id as string | null
            if (!id || seen.has(id)) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: generateDiagramId() })
              modified = true
            } else {
              seen.add(id)
            }
          })

          // L'assegnazione degli ID non deve finire nella cronologia di annulla/ripristina
          return modified ? tr.setMeta('addToHistory', false) : null
        },
      }),
    ]
  },
})