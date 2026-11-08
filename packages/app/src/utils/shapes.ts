// Frecce e marcatori di casella (cerchio o X): sulle mosse dell'albero e sui diagrammi.
// Si usano solo due "inchiostri" (verde = nero, rosso = grigio): sulla scacchiera interattiva
// restano verde e rosso di Chessground, nel diagramma e nel PDF diventano nero e grigio.

export type ShapeBrush = 'green' | 'red'

export interface BoardShape {
  orig: string          // casella di partenza ("e2")
  dest?: string         // casella di arrivo: se manca è un marcatore sulla casella
  brush: ShapeBrush
  mark?: 'x'            // marcatore a X invece del cerchio (solo senza dest)
}

export const SHAPE_INK: Record<ShapeBrush, string> = {
  green: '#111111',
  red: '#8a8a8a',
}

const SQUARE = /^[a-h][1-8]$/
export const MAX_SHAPES = 40

/** Qualunque pennello di Chessground/PGN diventa uno dei due: blu → verde, giallo → rosso */
export const normalizeBrush = (b: unknown): ShapeBrush => (b === 'red' || b === 'yellow' ? 'red' : 'green')

/**
 * Convalida e normalizza: caselle valide, due soli pennelli, niente doppioni (una casa ha un solo marcatore),
 * tetto di forme. Accetta anche le forme di Chessground: una X lì non ha pennello (non deve disegnare il cerchio)
 * e porta il colore in `xBrush`.
 */
export function cleanShapes(raw: unknown): BoardShape[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: BoardShape[] = []
  for (const s of raw) {
    if (out.length >= MAX_SHAPES) break
    if (!s || typeof s !== 'object') continue
    const { orig, dest, brush, mark, xBrush } = s as Record<string, unknown>
    if (typeof orig !== 'string' || !SQUARE.test(orig)) continue
    const hasDest = typeof dest === 'string' && SQUARE.test(dest) && dest !== orig
    const key = orig + (hasDest ? dest : '')
    if (seen.has(key)) continue
    seen.add(key)
    const isX = !hasDest && mark === 'x'
    out.push({
      orig,
      ...(hasDest ? { dest: dest as string } : {}),
      brush: normalizeBrush(isX && xBrush !== undefined ? xBrush : brush),
      ...(isX ? { mark: 'x' as const } : {}),
    })
  }
  return out
}

type Marker = { kind: 'circle' | 'x'; brush: ShapeBrush } | null
const markerAt = (shapes: BoardShape[], square: string): Marker => {
  const s = shapes.find((x) => x.orig === square && !x.dest)
  return s ? { kind: s.mark === 'x' ? 'x' : 'circle', brush: s.brush } : null
}

/**
 * Clic destro ripetuto sulla stessa casa: cerchio → X dello stesso colore → casa vuota.
 * Chessground conosce solo i cerchi: al secondo clic dello stesso colore toglie il cerchio, e su una X
 * (per lui una forma senza pennello) mette un cerchio. Qui si correggono i due casi.
 * Vale solo se è cambiata una sola casa, cioè per un gesto dell'utente (non per «Cancella frecce»).
 */
export function cycleMarkers(prev: BoardShape[], next: BoardShape[]): BoardShape[] {
  const squares = new Set([...prev, ...next].filter((s) => !s.dest).map((s) => s.orig))
  const changed = [...squares].filter((sq) => JSON.stringify(markerAt(prev, sq)) !== JSON.stringify(markerAt(next, sq)))
  if (changed.length !== 1) return next
  const sq = changed[0]
  const before = markerAt(prev, sq)
  const after = markerAt(next, sq)
  const others = next.filter((s) => s.dest || s.orig !== sq)
  // Cerchio tolto con lo stesso colore: diventa una X
  if (before?.kind === 'circle' && !after) return [...others, { orig: sq, brush: before.brush, mark: 'x' }]
  // Clic su una X: Chessground l'ha sostituita con un cerchio, invece la casa torna vuota
  if (before?.kind === 'x' && after?.kind === 'circle') return others
  return next
}

// Colori della X sulla scacchiera interattiva: quelli dei pennelli verde e rosso di Chessground
const BOARD_INK: Record<ShapeBrush, string> = { green: '#15781B', red: '#882020' }

/** Disegno della X per Chessground (customSvg, coordinate 0-100 sulla casa) */
export const boardXSvg = (brush: ShapeBrush) =>
  `<g stroke="${BOARD_INK[brush]}" stroke-width="9" stroke-linecap="round" opacity="0.85">`
  + '<line x1="22" y1="22" x2="78" y2="78"/><line x1="78" y1="22" x2="22" y2="78"/></g>'
