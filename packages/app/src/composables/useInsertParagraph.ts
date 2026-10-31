// Inserisce un paragrafo sopra o sotto un blocco (diagramma, albero): i blocchi non si "attraversano" col cursore
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

interface BlockNodeViewProps {
  editor: Editor
  node: PMNode
  getPos: () => number | undefined
}

export function useInsertParagraph(props: BlockNodeViewProps) {
  return (where: 'before' | 'after') => {
    const pos = props.getPos()
    if (typeof pos !== 'number') return
    const at = where === 'before' ? pos : pos + props.node.nodeSize
    props.editor.chain().insertContentAt(at, { type: 'paragraph' }).setTextSelection(at + 1).focus().run()
  }
}