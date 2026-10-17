import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
// CORREZIONE: Importa il componente come default export, senza l'asterisco *
import ChessTreeBlockView from '../components/ChessTreeBlockView.vue'

export const ChessTreeBlock = Node.create({
  name: 'chessTreeBlock',
  group: 'block',
  atom: true, // Impedisce a Tiptap di far entrare il cursore all'interno del blocco come testo normale
  draggable: true, // Permette di spostare il blocco, ma non interferisce con i click interni
  inline: false,
  // 2. IMPEDISCE A TIPTAP DI SELEZIONARE E SOVRASCRIVERE L'INTERO BLOCCO CON LA TASTIERA
  selectable: false,
  // 3. Isola gli eventi di cancellazione (Backspace/Canc) all'interno del blocco
  isolating: true,

  addAttributes() {
    return {
      treeId: {
        default: null,
        parseHTML: element => element.getAttribute('tree-id'),
        renderHTML: attributes => {
          if (!attributes.treeId) return {}
          return { 
            'tree-id': attributes.treeId,
            'data-tree-id': attributes.treeId 
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        // Riconosce il div salvato da renderHTML tramite il data-type
        tag: 'div[data-type="chess-tree-block"]',
      },
      {
        // Compatibilità con nodi che hanno l'attributo tree-id
        tag: 'div[tree-id]',
      },
      {
        // Compatibilità legacy se in precedenza usavi il tag custom
        tag: 'chess-tree-block',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
  return [
    'div',
    mergeAttributes(HTMLAttributes, {
      'data-type': 'chess-tree-block',
      class: 'chess-tree-block-container'
    }),
    // 0 indica a Tiptap di inserire il contenuto HTML passato durante l'esportazione
    ['div', { class: 'block-content' }]
  ]
},

  addNodeView() {
    // Ora riceve il componente corretto e VueNodeViewRenderer saprà come montarlo
    return VueNodeViewRenderer(ChessTreeBlockView)
  },
})