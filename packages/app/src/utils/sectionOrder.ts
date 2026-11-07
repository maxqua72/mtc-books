// Ordine delle sezioni del libro, come nei libri di scacchi: copertina, indice, poi i capitoli
import type { SectionIndexItem } from '../stores/book/types'

const RANK: Record<SectionIndexItem['type'], number> = { cover: 0, index: 1, chapter: 2 }

/** Nuovo elenco in ordine: copertina e indice in testa, i capitoli nell'ordine in cui erano */
export const orderSections = (sections: SectionIndexItem[]): SectionIndexItem[] =>
  sections.map((s, i) => ({ s, i }))
    .sort((a, b) => RANK[a.s.type] - RANK[b.s.type] || a.i - b.i)
    .map(({ s }) => s)
