import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import { findPieceLetters, figurineSpan } from '../utils/figurines'

const key = new PluginKey<DecorationSet>('figurines')

// Decorations di un solo blocco di testo (pos = posizione del blocco nel documento)
function buildBlock(node: PMNode, pos: number): Decoration[] {
  const out: Decoration[] = []
  // Si legge il blocco intero: una mossa può attraversare grassetto/corsivo. I nodi inline valgono un carattere, così gli indici restano posizioni
  const text = node.textBetween(0, node.content.size, undefined, '\ufffc')
  for (const { index, letter } of findPieceLetters(text)) {
    const from = pos + 1 + index
    out.push(
      Decoration.widget(from, () => figurineSpan(letter), { side: -1, key: `fig-${letter}` }),
      Decoration.inline(from, from + 1, { class: 'fig-hidden' })
    )
  }
  return out
}

function buildAll(doc: PMNode): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return
    decos.push(...buildBlock(node, pos))
    return false
  })
  return DecorationSet.create(doc, decos)
}

// Blocchi di testo (nel documento NUOVO) toccati dalla transazione
function touchedBlocks(tr: Transaction): { node: PMNode; pos: number }[] {
  const size = tr.doc.content.size
  const clamp = (n: number) => Math.max(0, Math.min(size, n))
  const found = new Map<number, PMNode>()

  tr.mapping.maps.forEach((stepMap, i) => {
    const rest = tr.mapping.slice(i + 1)            // gli step successivi spostano le posizioni
    stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      const from = clamp(rest.map(newStart, -1))
      const to = clamp(rest.map(newEnd, 1))
      tr.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isTextblock) return true          // scende nei contenitori (liste, ecc.)
        found.set(pos, node)
        return false
      })
    })
  })
  return [...found].map(([pos, node]) => ({ node, pos }))
}

export const Figurines = Extension.create({
  name: 'figurines',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: (_config, { doc }) => buildAll(doc),
          apply: (tr, old) => {
            if (!tr.docChanged) return old
            // Le decorations dei blocchi non toccati si spostano da sole
            let set = old.map(tr.mapping, tr.doc)
            for (const { node, pos } of touchedBlocks(tr)) {
              set = set.remove(set.find(pos, pos + node.nodeSize))
              set = set.add(tr.doc, buildBlock(node, pos))
            }
            return set
          },
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ]
  },
})