import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pgnInsertMarker: {
      /** Riquadro del PGN da importare (null = nessuno) */
      setPgnInsertMarker: (pos: number | null) => ReturnType
      /** Riquadro con un testo a scelta, es. l'anteprima del diagramma (null = nessuno) */
      setInsertMarker: (pos: number | null, text?: string) => ReturnType
    }
  }
}

interface MarkerState { pos: number; text: string }

const markerKey = new PluginKey<MarkerState | null>('pgnInsertMarker')
const PGN_TEXT = 'Il PGN verrà inserito qui'

// Disegna un riquadro tratteggiato nel punto in cui verrà inserito ciò che si sta per importare o inserire.
// È una decorazione: non entra mai nel documento salvato
export const PgnInsertMarker = Extension.create({
  name: 'pgnInsertMarker',

  addCommands() {
    return {
      setInsertMarker: (pos, text = PGN_TEXT) => ({ tr }) => {
        tr.setMeta(markerKey, { marker: pos === null ? null : { pos, text } })
        return true
      },
      setPgnInsertMarker: (pos) => ({ commands }) => commands.setInsertMarker(pos, PGN_TEXT),
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<MarkerState | null>({
        key: markerKey,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const meta = tr.getMeta(markerKey)
            if (meta) return meta.marker as MarkerState | null
            return value === null ? null : { ...value, pos: tr.mapping.map(value.pos) }
          },
        },
        props: {
          decorations(state) {
            const marker = markerKey.getState(state)
            if (!marker || marker.pos > state.doc.content.size) return null

            const widget = Decoration.widget(marker.pos, () => {
              const el = document.createElement('div')
              el.className = 'pgn-insert-marker'
              el.setAttribute('contenteditable', 'false')
              el.textContent = marker.text
              return el
            }, { side: -1, key: `insert-marker-${marker.text}` })

            return DecorationSet.create(state.doc, [widget])
          },
        },
      }),
    ]
  },
})
