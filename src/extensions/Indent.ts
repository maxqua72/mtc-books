import { Extension, type CommandProps } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

/**
 * Rientro a livelli (0..maxLevel) per paragrafi e titoli, salvato come data-indent="N".
 * La misura in mm sta in book-typography.css (condiviso con il PDF).
 * Dentro un elenco i comandi diventano "annida / disannida la voce".
 */
export const Indent = Extension.create<{ types: string[]; maxLevel: number }>({
  name: 'indent',

  addOptions() {
    return { types: ['paragraph', 'heading'], maxLevel: 6 }
  },

  addGlobalAttributes() {
    const max = this.options.maxLevel
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const n = Number(element.getAttribute('data-indent'))
              return Number.isInteger(n) && n > 0 ? Math.min(n, max) : 0
            },
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.indent ? { 'data-indent': attributes.indent } : {},
          },
        },
      },
    ]
  },

  addCommands() {
    const { types, maxLevel } = this.options

    const step = (delta: 1 | -1) => () => ({ commands, state, tr, dispatch }: CommandProps) => {
      if (this.editor.isActive('listItem')) {
        return delta > 0 ? commands.sinkListItem('listItem') : commands.liftListItem('listItem')
      }

      let changed = false
      const { from, to } = state.selection
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!types.includes(node.type.name)) return
        // i paragrafi dentro un elenco si gestiscono con annida/disannida
        if (state.doc.resolve(pos).parent.type.name === 'listItem') return
        const current = Number(node.attrs.indent) || 0
        const next = Math.min(maxLevel, Math.max(0, current + delta))
        if (next === current) return
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next })
        changed = true
      })

      if (changed && dispatch) dispatch(tr)
      return changed
    }

    return { indent: step(1), outdent: step(-1) }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-]': () => this.editor.commands.indent(),
      'Mod-[': () => this.editor.commands.outdent(),
    }
  },
})