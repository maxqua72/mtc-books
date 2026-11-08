// Geometria di frecce e marcatori sopra il diagramma testuale (SVG a griglia 10x10).
// Unità = una casella. La casella (colonna c, traversa r dall'alto) ha il centro in (c + 1.5, r + 1.5)
// perché la griglia ha un bordo a sinistra e una riga di bordo in alto. Con la scacchiera invertita si specchia.
import { cleanShapes, SHAPE_INK } from './shapes'
import { MERIDA_ADVANCE_EM } from './diagramSizes'

export type ShapeItem =
  | { kind: 'circle'; color: string; cx: number; cy: number }
  | { kind: 'x'; color: string; d: string }
  | { kind: 'arrow'; color: string; points: string }

/** X sulla casa: due diagonali, larghe quanto il diametro del cerchio meno un margine */
export const xPath = (c: Point): string => {
  const h = 0.3
  const f = (n: number) => n.toFixed(3)
  return `M${f(c.x - h)},${f(c.y - h)} L${f(c.x + h)},${f(c.y + h)} M${f(c.x + h)},${f(c.y - h)} L${f(c.x - h)},${f(c.y + h)}`
}

interface Point { x: number; y: number }

export const cellCenter = (square: string, flipped: boolean): Point => {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  const col = flipped ? 7 - file : file
  const row = flipped ? rank - 1 : 8 - rank
  return { x: col + 1.5, y: row + 1.5 }
}

export const arrowPoints = (from: Point, to: Point): string => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  const ux = dx / len, uy = dy / len
  const nx = -uy, ny = ux
  const bodyHalf = 0.07, headHalf = 0.2, headLen = 0.38
  const start = { x: from.x + ux * 0.25, y: from.y + uy * 0.25 }
  const tip = { x: to.x - ux * 0.12, y: to.y - uy * 0.12 }
  const base = { x: tip.x - ux * headLen, y: tip.y - uy * headLen }
  const pt = (p: Point, off: number, h: number) =>
    `${(p.x + nx * off * h).toFixed(3)},${(p.y + ny * off * h).toFixed(3)}`
  return [
    pt(start, 1, bodyHalf), pt(base, 1, bodyHalf), pt(base, 1, headHalf), pt(tip, 0, 0),
    pt(base, -1, headHalf), pt(base, -1, bodyHalf), pt(start, -1, bodyHalf)
  ].join(' ')
}

/** Da attributo `shapes` del nodo (anche non valido) agli elementi SVG da disegnare */
export const buildShapeItems = (raw: unknown, flipped: boolean): ShapeItem[] =>
  cleanShapes(raw).map((s): ShapeItem => {
    const color = SHAPE_INK[s.brush]
    const from = cellCenter(s.orig, flipped)
    if (!s.dest && s.mark === 'x') return { kind: 'x', color, d: xPath(from) }
    if (!s.dest) return { kind: 'circle', color, cx: from.x, cy: from.y }
    return { kind: 'arrow', color, points: arrowPoints(from, cellCenter(s.dest, flipped)) }
  })

// La larghezza segue l'avanzamento reale del font (MERIDA_ADVANCE_EM), l'altezza è il line-height.
// Stile inline: nel PDF non arrivano gli stili scoped dei componenti.
export const SHAPES_SVG_STYLE =
  'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;' +
  `width:calc(var(--diagram-size) * ${MERIDA_ADVANCE_EM * 10});height:calc(var(--diagram-size) * 10);`
