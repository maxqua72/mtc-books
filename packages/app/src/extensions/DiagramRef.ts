import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import DiagramRefNode from '../components/DiagramRefNode.vue'
import { useChessBookStore } from '../stores/chessBookStore'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    diagramRef: {
      insertDiagramRef: (targetId: string) => ReturnType
    }
  }
}

export const DiagramRef = Node.create({
  name: 'diagramRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      targetId: {
        default: null,
        parseHTML: element => element.getAttribute('data-target-id'),
        renderHTML: attributes => (attributes.targetId ? { 'data-target-id': attributes.targetId } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="diagram-ref"]' }]
  },

  // L'HTML salvato contiene il numero corrente (utile a chi legge l'HTML senza editor).
  // Nell'editor il numero lo calcola sempre il node view.
  renderHTML({ node, HTMLAttributes }) {
    const label = useChessBookStore().diagramLabels.get(node.attrs.targetId)?.label ?? '?'
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': 'diagram-ref', class: 'diagram-ref' }),
      label
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(DiagramRefNode)
  },

  addCommands() {
    return {
      insertDiagramRef: (targetId) => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: { targetId } }),
    }
  },
})