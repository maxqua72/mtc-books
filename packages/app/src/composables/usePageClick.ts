// Clic nello spazio vuoto del foglio (margini) o nell'area grigia attorno:
// il cursore va nell'elemento alla stessa altezza, non in fondo al documento
import type { ShallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'

type EditorRef = ShallowRef<Editor | undefined>

const TREE = 'chess-tree-block-container'
const DIAGRAM = 'chess-diagram-container'

/** Distanza di un valore da un intervallo (0 se è dentro) */
const gap = (v: number, from: number, to: number) => (v < from ? from - v : v > to ? v - to : 0)

/** Righe di testo di un blocco: rettangoli delle righe raggruppati per altezza */
function lineRects(el: HTMLElement): DOMRect[] {
  const range = document.createRange()
  range.selectNodeContents(el)
  return [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0)
}

/** Il blocco di primo livello alla stessa altezza del clic; a parità, il più vicino in orizzontale */
function blockAt(blocks: HTMLElement[], x: number, y: number): HTMLElement | null {
  const rows = blocks.filter(el => {
    const r = el.getBoundingClientRect()
    return y >= r.top && y <= r.bottom
  })
  if (rows.length) {
    // Accanto a un diagramma a margine ci sono sia il diagramma sia il paragrafo: vince il più vicino al clic.
    // A parità di distanza, il testo ha la precedenza sul diagramma
    const score = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      const lines = el.classList.contains(DIAGRAM) ? [] : lineRects(el).filter(l => y >= l.top && y <= l.bottom)
      const left = lines.length ? Math.min(...lines.map(l => l.left)) : r.left
      const right = lines.length ? Math.max(...lines.map(l => l.right)) : r.right
      return gap(x, left, right) + (el.classList.contains(DIAGRAM) ? 0.5 : 0)
    }
    return rows.reduce((best, el) => (score(el) < score(best) ? el : best))
  }
  // Clic tra due blocchi (spazio tra i paragrafi, margine sopra il primo): il blocco più vicino in verticale
  return blocks.reduce<HTMLElement | null>((best, el) => {
    if (!best) return el
    const r = el.getBoundingClientRect()
    const b = best.getBoundingClientRect()
    return gap(y, r.top, r.bottom) < gap(y, b.top, b.bottom) ? el : best
  }, null)
}

export function usePageClick(editor: EditorRef) {
  const placeCaretNear = (x: number, y: number) => {
    const ed = editor.value
    if (!ed) return
    const view = ed.view
    const blocks = [...view.dom.children].filter((el): el is HTMLElement =>
      el instanceof HTMLElement && !el.classList.contains('pgn-insert-marker'))

    // Sotto l'ultimo elemento (o documento vuoto): come prima, cursore in fondo
    const last = blocks[blocks.length - 1]
    if (!last || y > last.getBoundingClientRect().bottom) {
      ed.chain().focus('end').run()
      return
    }

    const el = blockAt(blocks, x, y)
    if (!el) return

    // Albero: si attiva come con un clic sul blocco
    if (el.classList.contains(TREE)) {
      el.click()
      return
    }
    // Diagramma senza testo accanto: nessun salto
    if (el.classList.contains(DIAGRAM)) return

    // Testo: la riga più vicina in verticale, poi il punto più vicino in orizzontale su quella riga
    const lines = lineRects(el)
    if (!lines.length) {
      ed.chain().focus().setTextSelection(view.posAtDOM(el, 0)).run()
      return
    }
    const line = lines.reduce((best, l) => (gap(y, l.top, l.bottom) < gap(y, best.top, best.bottom) ? l : best))
    const top = (line.top + line.bottom) / 2
    const row = lines.filter(l => top >= l.top && top <= l.bottom)
    const left = Math.min(...row.map(l => l.left))
    const right = Math.max(...row.map(l => l.right))
    const hit = view.posAtCoords({ left: Math.min(Math.max(x, left + 1), right - 1), top })
    if (hit) ed.chain().focus().setTextSelection(hit.pos).run()
  }

  // Margini del foglio (solo clic diretti sul foglio, non sul testo)
  const handlePageClick = (event: MouseEvent) => placeCaretNear(event.clientX, event.clientY)

  // Area grigia attorno al foglio
  const handleCanvasClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.id === 'book-editor-content' || target.classList.contains('editor-scroll-wrapper')) {
      placeCaretNear(event.clientX, event.clientY)
    }
  }

  return { handlePageClick, handleCanvasClick }
}
