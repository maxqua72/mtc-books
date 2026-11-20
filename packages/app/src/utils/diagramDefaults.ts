// Attributi di un diagramma nuovo: dimensione e allineamento predefiniti del libro (Proprietà del libro)
import type { BookMetadata } from '../stores/book/types'
import type { BoardShape } from './shapes'

/** Nodo chessDiagram da inserire con insertContentAt */
export function newDiagramNode(meta: BookMetadata, fen: string, opts: { flipped?: boolean; shapes?: BoardShape[] | null } = {}) {
  return {
    type: 'chessDiagram',
    attrs: {
      fen,
      flipped: !!opts.flipped,
      shapes: opts.shapes?.length ? opts.shapes : null,
      size: meta.diagramDefaultSize ?? null,      // null = media
      align: meta.diagramDefaultAlign ?? 'center',
    },
  }
}
