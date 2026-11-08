// Comando «Converti mosse»: mosse dettate nella selezione (o nel paragrafo) → notazione algebrica
import { ref, type ShallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import type { Node as PMNode } from '@tiptap/pm/model'
import { findDictatedMoves } from '../utils/dictatedMoves'

type EditorRef = ShallowRef<Editor | undefined>

const PROTECTED_NODES = ['chessDiagram', 'chessTreeBlock']   // come ProtectChessNodes: mai analizzati
const CONTEXT = 30                                            // caratteri di contesto nell'anteprima

export const NO_MOVES_MESSAGE = 'Nessuna mossa dettata trovata'
export const DOC_CHANGED_MESSAGE =
  'Il testo è cambiato dopo l’apertura dell’anteprima: le mosse non sono state convertite. Usa di nuovo «Converti mosse».'

export interface DictatedMoveItem {
  id: number
  from: number           // posizioni ProseMirror
  to: number
  before: string         // contesto prima e dopo, con «…» se tagliato
  original: string
  after: string
  replacement: string
}

interface Block { node: PMNode; pos: number }

/** Blocchi di testo da analizzare: quelli toccati dalla selezione, o quello del cursore */
function blocksInScope(editor: Editor): { blocks: Block[]; from: number; to: number } {
  const { doc, selection } = editor.state
  const blocks: Block[] = []
  if (!selection.empty) {
    doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (PROTECTED_NODES.includes(node.type.name)) return false
      if (!node.isTextblock) return true
      blocks.push({ node, pos })
      return false
    })
    return { blocks, from: selection.from, to: selection.to }
  }
  const { $from } = selection
  for (let d = $from.depth; d > 0; d--) {
    if (PROTECTED_NODES.includes($from.node(d).type.name)) return { blocks, from: 0, to: 0 }
  }
  if ($from.parent.isTextblock) blocks.push({ node: $from.parent, pos: $from.before() })
  return { blocks, from: 0, to: doc.content.size }
}

function findItems(editor: Editor): DictatedMoveItem[] {
  const { blocks, from, to } = blocksInScope(editor)
  const items: DictatedMoveItem[] = []
  for (const { node, pos } of blocks) {
    // Stessa tecnica di Figurines.ts: i nodi inline valgono un carattere, così gli indici restano posizioni
    const text = node.textBetween(0, node.content.size, undefined, '￼')
    const base = pos + 1
    const lo = Math.max(0, from - base)
    const hi = Math.min(text.length, to - base)
    if (hi <= lo) continue
    for (const r of findDictatedMoves(text.slice(lo, hi))) {
      const start = lo + r.start
      const end = lo + r.end
      const b = Math.max(0, start - CONTEXT)
      const a = Math.min(text.length, end + CONTEXT)
      items.push({
        id: items.length,
        from: base + start,
        to: base + end,
        before: (b > 0 ? '…' : '') + text.slice(b, start).replaceAll('￼', ' '),
        original: r.original,
        after: text.slice(end, a).replaceAll('￼', ' ') + (a < text.length ? '…' : ''),
        replacement: r.replacement,
      })
    }
  }
  return items
}

export function useConvertDictatedMoves(editor: EditorRef) {
  const isOpen = ref(false)
  const items = ref<DictatedMoveItem[]>([])
  let docAtOpen: PMNode | null = null

  const close = () => {
    isOpen.value = false
    items.value = []
    docAtOpen = null
  }

  const open = () => {
    const ed = editor.value
    if (!ed || !ed.isEditable) return
    const found = findItems(ed)
    if (!found.length) { alert(NO_MOVES_MESSAGE); return }
    items.value = found
    docAtOpen = ed.state.doc
    isOpen.value = true
  }

  /** Applica le voci scelte in una sola transazione (un solo Ctrl+Z) */
  const apply = (ids: number[]) => {
    const ed = editor.value
    if (!ed) return close()
    if (ed.state.doc !== docAtOpen) {
      close()
      alert(DOC_CHANGED_MESSAGE)
      return
    }
    const chosen = items.value.filter(i => ids.includes(i.id)).sort((x, y) => y.from - x.from)
    close()
    if (!chosen.length) return
    const { state } = ed
    const tr = state.tr
    // Dall'ultima alla prima: le posizioni precedenti non cambiano
    for (const it of chosen) {
      const marks = state.doc.nodeAt(it.from)?.marks ?? []
      tr.replaceWith(it.from, it.to, state.schema.text(it.replacement, marks))
    }
    ed.view.dispatch(tr.scrollIntoView())
    ed.commands.focus()
  }

  return { isOpen, items, open, apply, close }
}
