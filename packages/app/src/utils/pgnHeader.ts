// Intestazione leggibile ricavata dai tag PGN di un albero importato.
// Si mostrano solo i tag presenti e noti: "?" e valori vuoti vengono omessi.

export interface TreeHeaderView {
  players: string   // "Bianco (elo) – Nero (elo)"
  result: string    // "1–0", "½–½", "0–1"
  event: string     // "Evento, Luogo, turno N, GG.MM.AAAA"
  opening: string   // "ECO – Apertura"
}

type Header = Record<string, string> | undefined

// Valori "sconosciuti" del PGN: vuoto, "?", "??", "*", "-"
const clean = (value?: string): string => {
  const s = (value ?? '').trim()
  return !s || /^[?*\-.]+$/.test(s) ? '' : s
}

// 2024.03.15 -> 15.03.2024; 2024.03.?? -> 03.2024; 2024.??.?? -> 2024
const formatDate = (raw?: string): string => {
  const parts = (raw ?? '').trim().split('.')
  const [y, m, d] = parts
  if (!y || !/^\d{4}$/.test(y)) return ''
  if (!m || !/^\d{1,2}$/.test(m)) return y
  if (!d || !/^\d{1,2}$/.test(d)) return `${m.padStart(2, '0')}.${y}`
  return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`
}

const formatResult = (raw?: string): string => {
  const s = (raw ?? '').trim()
  if (s === '1-0') return '1–0'
  if (s === '0-1') return '0–1'
  if (s === '1/2-1/2') return '½–½'
  return clean(s)
}

const player = (name: string, elo: string): string =>
  name ? (elo ? `${name} (${elo})` : name) : '?'

export function getHeaderView(header: Header): TreeHeaderView | null {
  if (!header) return null

  const white = clean(header.White)
  const black = clean(header.Black)
  const players = white || black
    ? `${player(white, clean(header.WhiteElo))} – ${player(black, clean(header.BlackElo))}`
    : ''

  const round = clean(header.Round)
  const event = [
    clean(header.Event),
    clean(header.Site),
    round ? `turno ${round}` : '',
    formatDate(header.Date),
  ].filter(Boolean).join(', ')

  const opening = [clean(header.ECO), clean(header.Opening)].filter(Boolean).join(' – ')
  const result = formatResult(header.Result)

  if (!players && !event && !opening && !result) return null
  return { players, result, event, opening }
}

/** C'è qualcosa da mostrare? (decide se la console offre l'interruttore) */
export const hasDisplayableHeader = (header: Header): boolean => getHeaderView(header) !== null

/** Valore iniziale dell'interruttore: acceso solo se ci sono giocatori o evento */
export const shouldShowHeaderByDefault = (header: Header): boolean =>
  !!header && !!(clean(header.White) || clean(header.Black) || clean(header.Event))
