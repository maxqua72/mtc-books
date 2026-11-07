// HTML delle sezioni generate dall'app. Lo stesso HTML va nell'editor (in sola lettura, dove gli stili in linea
// si perdono) e nel PDF (dove gli !important in linea battono le regole degli elenchi del testo).
import type { ChessMoveNode, ChessTree } from '../stores/chessTreeStore'
import { escapeHtml } from './html'
import { NAG_GROUPS } from './nags'

export const FONT = 'font-family: Lora, Georgia, serif;'
const LIST = `list-style: none !important; padding: 0 !important; margin: 0 0 2mm 0 !important; ${FONT}`
const ITEM = 'display: flex !important; align-items: baseline; gap: 8px; margin: 0 0 4px 0 !important; padding: 0 !important; break-inside: avoid;'
const GROUP = `${FONT} font-weight: bold; margin: 5mm 0 2mm 0;`
const EMPTY = 'color: #a3a3a3; font-style: italic;'

/** Titolo 1 della sezione: data-toc-level lo fa entrare nell'indice generale, senza numero */
export const sectionTitleHtml = (title: string) =>
  `<h2 data-toc-level="1" style="${FONT} font-size: 2rem; margin-bottom: 1.5rem;">${escapeHtml(title)}</h2>`

const walk = (nodes: ChessMoveNode[], visit: (n: ChessMoveNode) => void) => {
  const stack = [...nodes]
  while (stack.length) {
    const n = stack.pop()!
    visit(n)
    if (n.children?.length) stack.push(...n.children)
  }
}

export interface UsedSymbols { nags: Set<number>; check: boolean; mate: boolean }

/** Simboli che compaiono davvero negli alberi del libro, varianti comprese */
export function collectSymbols(trees: ChessTree[]): UsedSymbols {
  const used: UsedSymbols = { nags: new Set(), check: false, mate: false }
  for (const t of trees) {
    walk(t.rootNodes ?? [], (n) => {
      n.nags?.forEach((c) => used.nags.add(c))
      if (n.san?.endsWith('#')) used.mate = true
      else if (n.san?.endsWith('+')) used.check = true
    })
  }
  return used
}

const row = (symbol: string, label: string) =>
  `<li style="${ITEM}"><strong style="display: inline-block; min-width: 3.5em;">${escapeHtml(symbol)}</strong> <span>${escapeHtml(label)}</span></li>`

/** Legenda dei simboli: solo quelli usati nel libro, nei gruppi della palette dei simboli */
export function symbolsLegendHtml(title: string, used: UsedSymbols): string {
  const groups: { title: string; rows: string[] }[] = []
  const moves = [used.check && row('+', 'Scacco'), used.mate && row('#', 'Scacco matto')].filter(Boolean) as string[]
  if (moves.length) groups.push({ title: 'Mosse', rows: moves })
  for (const g of NAG_GROUPS) {
    const rows = g.items.filter((i) => used.nags.has(i.code)).map((i) => row(i.symbol, i.label))
    if (rows.length) groups.push({ title: g.title, rows })
  }
  const body = groups.length
    ? groups.map((g) => `<p style="${GROUP}">${escapeHtml(g.title)}</p><ul style="${LIST}">${g.rows.join('')}</ul>`).join('')
    : `<p style="${EMPTY}">Nel libro non ci sono ancora simboli: compaiono qui quando li usi nelle mosse.</p>`
  return `<div class="generated-section symbol-legend">${sectionTitleHtml(title)}${body}</div>`
}
