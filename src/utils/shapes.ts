// Frecce e marcatori di casella: sulle mosse dell'albero e sui diagrammi.
// Si usano solo due "inchiostri" (verde = nero, rosso = grigio): sulla scacchiera interattiva
// restano verde e rosso di Chessground, nel diagramma e nel PDF diventano nero e grigio.

export type ShapeBrush = 'green' | 'red'

export interface BoardShape {
  orig: string          // casella di partenza ("e2")
  dest?: string         // casella di arrivo: se manca è un cerchio sulla casella
  brush: ShapeBrush
}

export const SHAPE_INK: Record<ShapeBrush, string> = {
  green: '#111111',
  red: '#8a8a8a',
}

const SQUARE = /^[a-h][1-8]$/
export const MAX_SHAPES = 40

/** Qualunque pennello di Chessground/PGN diventa uno dei due: blu → verde, giallo → rosso */
export const normalizeBrush = (b: unknown): ShapeBrush => (b === 'red' || b === 'yellow' ? 'red' : 'green')

/** Convalida e normalizza: caselle valide, due soli pennelli, niente doppioni, tetto di forme */
export function cleanShapes(raw: unknown): BoardShape[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: BoardShape[] = []
  for (const s of raw) {
    if (out.length >= MAX_SHAPES) break
    if (!s || typeof s !== 'object') continue
    const { orig, dest, brush } = s as Record<string, unknown>
    if (typeof orig !== 'string' || !SQUARE.test(orig)) continue
    const hasDest = typeof dest === 'string' && SQUARE.test(dest) && dest !== orig
    const key = orig + (hasDest ? dest : '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ orig, ...(hasDest ? { dest: dest as string } : {}), brush: normalizeBrush(brush) })
  }
  return out
}
