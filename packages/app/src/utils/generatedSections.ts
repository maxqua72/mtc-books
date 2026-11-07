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

// --- Indici delle partite e dei giocatori ---

export interface BookGame {
  white: string
  black: string
  event: string
  date: string
  /** Riferimenti ai blocchi della partita: pdf-core ne trova la pagina (data-page-anchor in ChessTreeBlockView) */
  refs: string[]
}

const tag = (tree: ChessTree, name: string) => {
  const v = tree.header?.[name]?.trim() ?? ''
  return v === '?' || v === '????.??.??' ? '' : v
}

/**
 * Partite del libro: alberi importati con almeno un giocatore nell'intestazione PGN. Un albero diviso in più
 * blocchi conta una volta (il primo blocco). La stessa partita citata più volte, con la stessa intestazione,
 * diventa una sola voce con più pagine.
 */
export function collectGames(trees: ChessTree[]): BookGame[] {
  const games = new Map<string, BookGame>()
  for (const tree of trees) {
    if (tree.parentTreeId) continue
    const white = tag(tree, 'White')
    const black = tag(tree, 'Black')
    if (!white && !black) continue
    const event = tag(tree, 'Event')
    const date = tag(tree, 'Date')
    const key = [white, black, event, date, tag(tree, 'Round')].join('\u0000')
    const game = games.get(key) ?? { white, black, event, date, refs: [] }
    game.refs.push(`tree-${tree.id}`)
    games.set(key, game)
  }
  return [...games.values()]
}

const byName = (a: string, b: string) => a.localeCompare(b, 'it', { sensitivity: 'base' })

/** Anno di una data PGN (1851.06.21 → 1851) */
const year = (date: string) => date.match(/^\d{4}/)?.[0] ?? date

/** Voce con puntini e numeri di pagina: pdf-core scrive i numeri in .page-refs (prima «…», come nell'indice) */
const indexEntry = (labelHtml: string, refs: string[]) =>
  `<li class="index-entry" style="${ITEM} margin-bottom: 6px !important;">`
  + `<span>${labelHtml}</span>`
  + '<span style="flex: 1; border-bottom: 1px dotted #a3a3a3; transform: translateY(-3px);"></span>'
  + `<span class="page-refs" data-page-refs="${refs.map(escapeHtml).join(' ')}" style="text-align: right; font-variant-numeric: tabular-nums; color: #404040;">…</span></li>`

/** Indice delle partite, in ordine alfabetico del Bianco, poi del Nero */
export function gamesIndexHtml(title: string, games: BookGame[]): string {
  const sorted = [...games].sort((a, b) => byName(a.white, b.white) || byName(a.black, b.black) || a.date.localeCompare(b.date))
  const body = sorted.length
    ? `<ul style="${LIST}">${sorted.map((g) => {
      const details = [g.event, year(g.date)].filter(Boolean).join(' ')
      const label = `<strong>${escapeHtml(g.white || '?')} – ${escapeHtml(g.black || '?')}</strong>${details ? `, ${escapeHtml(details)}` : ''}`
      return indexEntry(label, g.refs)
    }).join('')}</ul>`
    : `<p style="${EMPTY}">Nel libro non ci sono ancora partite: compaiono qui le partite importate da PGN con i nomi dei giocatori.</p>`
  return `<div class="generated-section games-index">${sectionTitleHtml(title)}${body}</div>`
}

/** Indice dei giocatori: ogni giocatore con le pagine di tutte le sue partite, con il Bianco e con il Nero */
export function playersIndexHtml(title: string, games: BookGame[]): string {
  const players = new Map<string, string[]>()
  for (const g of games) {
    for (const name of [g.white, g.black]) {
      if (!name) continue
      players.set(name, [...(players.get(name) ?? []), ...g.refs])
    }
  }
  const sorted = [...players.entries()].sort(([a], [b]) => byName(a, b))
  const body = sorted.length
    ? `<ul style="${LIST}">${sorted.map(([name, refs]) => indexEntry(escapeHtml(name), refs)).join('')}</ul>`
    : `<p style="${EMPTY}">Nel libro non ci sono ancora giocatori: compaiono qui i nomi delle partite importate da PGN.</p>`
  return `<div class="generated-section players-index">${sectionTitleHtml(title)}${body}</div>`
}
