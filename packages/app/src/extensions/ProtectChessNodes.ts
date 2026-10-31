import { Extension } from '@tiptap/core'
import { NodeSelection, Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'

const PROTECTED_NODES = ['chessDiagram', 'chessTreeBlock']
const isProtected = (node?: PMNode | null) => !!node && PROTECTED_NODES.includes(node.type.name)

/** La selezione contiene interamente un nodo protetto (selezionato o dentro un intervallo) */
const selectionCoversProtectedNode = (state: EditorState): boolean => {
  const { selection, doc } = state
  if (selection instanceof NodeSelection) return isProtected(selection.node)
  if (selection.empty) return false

  let found = false
  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (isProtected(node) && pos >= selection.from && pos + node.nodeSize <= selection.to) found = true
    return !found
  })
  return found
}

/** Il cursore è sul bordo di un blocco di testo e il tasto toccherebbe un nodo protetto */
const cursorTouchesProtectedNode = (state: EditorState, direction: 'backward' | 'forward'): boolean => {
  const { selection, doc } = state
  if (!selection.empty) return false
  const { $from } = selection
  if ($from.depth === 0) return false // gap cursor: lo gestisce ProseMirror

  const atEdge = direction === 'backward'
    ? $from.parentOffset === 0
    : $from.parentOffset === $from.parent.content.size
  if (!atEdge) return false

  // Cursore dentro il nodo protetto (es. didascalia del diagramma)
  if (isProtected($from.parent)) return true

  // Nodo adiacente al blocco di testo
  const neighbour = direction === 'backward'
    ? doc.resolve($from.before()).nodeBefore
    : doc.resolve($from.after()).nodeAfter
  return isProtected(neighbour)
}

export const ProtectChessNodes = Extension.create({
  name: 'protectChessNodes',
  priority: 1000, // deve passare prima del keymap standard di Tiptap

  addKeyboardShortcuts() {
    const handler = (direction: 'backward' | 'forward') => () => {
      const state = this.editor.state
      const blocked =
        selectionCoversProtectedNode(state) || cursorTouchesProtectedNode(state, direction)
      if (!blocked) return false

      // Eccezione: un paragrafo vuoto accanto al nodo si può eliminare (solo lui),
      // tranne se è l'ultimo del documento, per poter continuare a scrivere sotto il blocco
      const { $from, empty } = state.selection
      const isEmptyParagraph =
        empty && $from.depth > 0 &&
        $from.parent.type.name === 'paragraph' &&
        $from.parent.content.size === 0
      const isLastNode = isEmptyParagraph && state.doc.resolve($from.after()).nodeAfter === null

      if (isEmptyParagraph && !isLastNode) {
        this.editor.commands.command(({ tr }) => {
          tr.delete($from.before(), $from.after())
          return true
        })
      }
      return true // true = evento consumato, il tasto non fa altro
    }

    // Invio nella didascalia di un diagramma: la conferma (niente spezzare il diagramma in due)
    const confirmCaption = () => {
      const { $from, empty } = this.editor.state.selection
      if (!empty || $from.depth === 0 || $from.parent.type.name !== 'chessDiagram') return false
      const pos = $from.before()
      const attrs = $from.parent.attrs
      this.editor.chain()
        .command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, { ...attrs, captionEditable: false })
          return true
        })
        .blur()
        .run()
      return true
    }

    return {
      Enter: confirmCaption,
      Backspace: handler('backward'),
      'Mod-Backspace': handler('backward'),
      'Shift-Backspace': handler('backward'),
      Delete: handler('forward'),
      'Mod-Delete': handler('forward'),
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('protectChessNodesInput'),
        props: {
          // Digitare con un nodo selezionato lo sostituirebbe con il carattere
          handleTextInput: (view) => selectionCoversProtectedNode(view.state),
        },
      }),
    ]
  },
})