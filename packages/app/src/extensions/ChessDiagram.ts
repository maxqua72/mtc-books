import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { fenToBoardString } from '../utils/chessFormatter'
import { isValidFen } from '../utils/sanitize'
import { cleanShapes, type BoardShape } from '../utils/shapes'
import { STANDARD_FEN } from '../utils/fen'
import { newUuid } from '../utils/ids'
import ChessDiagramNode from '../components/ChessDiagramNode.vue'
import { useChessBookStore } from '../stores/chessBookStore'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chessDiagram: {
      insertChessDiagram: (attributes: { fen: string; flipped?: boolean; shapes?: BoardShape[]; caption?: string }) => ReturnType
    }
  }
}

const generateDiagramId = () => newUuid('dg')

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
        // Un id non valido diventa null e il plugin ne genera uno nuovo
        parseHTML: element => {
          const value = element.getAttribute('data-id')
          return value && /^[\w-]{1,80}$/.test(value) ? value : null
        },
        renderHTML: attributes => (attributes.id ? { 'data-id': attributes.id } : {}),
      },
      fen: {
        default: STANDARD_FEN,
        parseHTML: element => {
          const fen = element.getAttribute('fen')
          if (isValidFen(fen)) return fen
          console.warn('[ChessDiagram] FEN non valido nel documento, uso la posizione iniziale:', fen)
          return STANDARD_FEN
        },
      },
      size: {
        default: null, // Se è null, userà la dimensione globale dello store
      },
      align: {
        default: 'center',
        parseHTML: element => {
          const value = element.getAttribute('data-align')
          return value === 'left' || value === 'right' ? value : 'center'
        },
        renderHTML: attributes => ({ 'data-align': attributes.align || 'center' }),
      },
      flipped: {
        default: false,
        parseHTML: element => element.getAttribute('data-flipped') === 'true',
        renderHTML: attributes => (attributes.flipped ? { 'data-flipped': 'true' } : {}),
      },
      // Frecce e marcatori (istantanea presa dalla scacchiera all'inserimento)
      shapes: {
        default: null,
        parseHTML: element => {
          try {
            const list = cleanShapes(JSON.parse(element.getAttribute('data-shapes') || '[]'))
            return list.length ? list : null
          } catch {
            return null
          }
        },
        renderHTML: attributes =>
          Array.isArray(attributes.shapes) && attributes.shapes.length
            ? { 'data-shapes': JSON.stringify(attributes.shapes) }
            : {},
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
  renderHTML({ node, HTMLAttributes }) {
    const fen = HTMLAttributes.fen || ''
    const boardText = fenToBoardString(fen, !!node.attrs.flipped)

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
      /*
      insertChessDiagram: (options) => ({ chain }) => {
        if (!isValidFen(options.fen)) return false
        const shapes = cleanShapes(options.shapes)
        const caption = options.caption?.trim()
        return chain()
          .insertContent({
            type: this.name,
            attrs: { fen: options.fen, flipped: !!options.flipped, shapes: shapes.length ? shapes : null },
            ...(caption ? { content: [{ type: 'text', text: caption }] } : {}),
          })
          .run()
      },*/
      insertChessDiagram: (options) => ({ commands }) => {
        if (!isValidFen(options.fen)) return false
        const shapes = cleanShapes(options.shapes)
        const caption = options.caption?.trim()
        return commands.insertContent({
          type: this.name,
          attrs: { fen: options.fen, flipped: !!options.flipped, shapes: shapes.length ? shapes : null },
          ...(caption ? { content: [{ type: 'text', text: caption }] } : {}),
        })
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

          // Il confronto con gli altri capitoli serve solo quando arriva contenuto da fuori
          const incoming = transactions.some(tr => ['paste', 'drop'].includes(tr.getMeta('uiEvent')))
          let elsewhere: Set<string> | null = null
          const usedElsewhere = (id: string) =>
            incoming && (elsewhere ??= useChessBookStore().diagramIdsOutsideActive()).has(id)

          const seen = new Set<string>()
          const tr = newState.tr
          let modified = false

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== this.name) return
            const id = node.attrs.id as string | null
            if (!id || seen.has(id) || usedElsewhere(id)) {
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