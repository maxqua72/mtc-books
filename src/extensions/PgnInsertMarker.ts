import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pgnInsertMarker: {
      setPgnInsertMarker: (pos: number | null) => ReturnType
    }
  }
}

const markerKey = new PluginKey<number | null>('pgnInsertMarker')

// Disegna un riquadro tratteggiato nel punto in cui verrà inserito il blocco importato
export const PgnInsertMarker = Extension.create({
  name: 'pgnInsertMarker',

  addCommands() {
    return {
      setPgnInsertMarker: (pos) => ({ tr }) => {
        tr.setMeta(markerKey, { pos })
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<number | null>({
        key: markerKey,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const meta = tr.getMeta(markerKey)
            if (meta) return meta.pos as number | null
            return value === null ? null : tr.mapping.map(value)
          },
        },
        props: {
          decorations(state) {
            const pos = markerKey.getState(state)
            if (pos === null || pos === undefined || pos > state.doc.content.size) return null

            const widget = Decoration.widget(pos, () => {
              const el = document.createElement('div')
              el.className = 'pgn-insert-marker'
              el.setAttribute('contenteditable', 'false')
              el.textContent = 'Il PGN verrà inserito qui'
              return el
            }, { side: -1, key: 'pgn-insert-marker' })

            return DecorationSet.create(state.doc, [widget])
          },
        },
      }),
    ]
  },
})