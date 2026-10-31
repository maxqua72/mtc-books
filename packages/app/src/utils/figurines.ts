// Figurine nel testo: riconoscimento delle mosse in notazione inglese e rese (decorations / DOM)

export const FIGURINES: Record<string, { cls: string; map: Record<string, string> }> = {
  cases: {
    cls: 'chess-cases-figurine',
    map: { K: 'k', Q: 'q', R: 'r', B: 'b', N: 'n' }
  },
  goodcompanions: {
    cls: 'tgc-figurine',
    map: { K: '0', Q: 'G', R: 'W', B: 'm', N: '©' }
  }
}
export const DEFAULT_FIGURINE = 'goodcompanions'

// Nf3, Nbd7, N1f3, Qxe5, Qh4xe1+, Rad1  |  promozioni: e8=Q, exd8=N
// Confini: niente lettere/cifre prima e dopo, così «Be4» dentro una parola non conta
const MOVE_RE = new RegExp(
  '(?<![\\p{L}\\p{N}])' +
  '(?:([KQRBN])(?:[a-h][1-8]?|[1-8])?x?[a-h][1-8]|(?:[a-h]x)?[a-h][18]=([QRBN]))' +
  '[+#]?(?![\\p{L}\\p{N}])',
  'gu'
)

export interface PieceLetter { index: number; letter: string }

/** Posizioni (nel testo) delle lettere dei pezzi che fanno parte di una mossa */
export function findPieceLetters(text: string): PieceLetter[] {
  const out: PieceLetter[] = []
  for (const m of text.matchAll(MOVE_RE)) {
    if (m[1]) out.push({ index: m.index, letter: m[1] })
    else out.push({ index: m.index + m[0].indexOf('=') + 1, letter: m[2] })
  }
  return out
}

export function figurineSpan(letter: string, set = DEFAULT_FIGURINE): HTMLSpanElement {
  const cfg = FIGURINES[set]
  const el = document.createElement('span')
  el.className = `fig ${cfg.cls}`
  el.dataset.p = letter                 // la lettera originale, per tornare al testo
  el.contentEditable = 'false'
  el.textContent = cfg.map[letter]
  return el
}

// ---------------------------------------------------------------------------
// Versione DOM (commenti dei blocchi albero, indice per il PDF)
// ---------------------------------------------------------------------------
const FIG = 'span.fig'

/**
 * Riporta tutto a testo semplice e rifà le figurine (idempotente).
 * Il caret si conserva: una figurina conta 1 carattere, come la lettera che sostituisce.
 */
export function applyFigurines(root: HTMLElement) {
  const sel = window.getSelection()
  const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null
  const hasCaret = !!range && range.collapsed && root.contains(range.startContainer)
  let caret = 0
  if (hasCaret) {
    const r = document.createRange()
    r.selectNodeContents(root)
    r.setEnd(range!.startContainer, range!.startOffset)
    caret = r.toString().length
  }

  root.querySelectorAll<HTMLElement>(FIG).forEach(s => s.replaceWith(document.createTextNode(s.dataset.p ?? '')))
  root.normalize()

  const texts: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text)

  for (const t of texts) {
    const blocked = t.parentElement?.closest('[contenteditable="false"]')
    if (blocked && blocked !== root && root.contains(blocked)) continue   // es. riferimenti a diagrammi
    const hits = findPieceLetters(t.data)
    for (let k = hits.length - 1; k >= 0; k--) {
      const { index, letter } = hits[k]
      t.splitText(index + 1)
      t.splitText(index).replaceWith(figurineSpan(letter))
    }
  }

  if (!hasCaret || !sel) return
  const r = document.createRange()
  let left = caret
  let placed = false
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
    if (left <= n.length) {
      const fig = n.parentElement?.closest<HTMLElement>(FIG)
      if (fig) { if (left === 0) r.setStartBefore(fig); else r.setStartAfter(fig) }
      else r.setStart(n, left)
      placed = true
      break
    }
    left -= n.length
  }
  if (!placed) { r.selectNodeContents(root); r.collapse(false) }
  r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
}

/** HTML del commento senza figurine (quello che si salva) */
export function plainFigurineHtml(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll<HTMLElement>(FIG).forEach(s => s.replaceWith(document.createTextNode(s.dataset.p ?? '')))
  return clone.innerHTML
}

/** Testo selezionato con le lettere al posto delle figurine (per copia e taglia) */
export function selectionPlainText(): string {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return ''
  const holder = document.createElement('div')
  holder.appendChild(sel.getRangeAt(0).cloneContents())
  holder.querySelectorAll<HTMLElement>(FIG).forEach(s => s.replaceWith(document.createTextNode(s.dataset.p ?? '')))
  return holder.textContent ?? ''
}

/** Per HTML generato (es. l'indice nel PDF) */
export function figurinizeHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  applyFigurines(div)
  return div.innerHTML
}