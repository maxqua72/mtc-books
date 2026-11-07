// Tipi e ordine delle sezioni del libro, come nei libri di scacchi:
// copertina, indice, sezioni senza numero iniziali, capitoli, sezioni senza numero finali
import type { SectionIndexItem, SectionType } from '../stores/book/types'

/** Si scrive nell'editor di testo: capitoli e sezioni senza numero */
export const isContentSection = (type: SectionType | undefined): boolean => type === 'chapter' || type === 'text'

/** Senza numero e spostabile prima o dopo i capitoli */
export const isFreeSection = (type: SectionType | undefined): boolean => type === 'text'

/** Una sezione senza numero sta in fondo se viene dopo il primo capitolo; senza capitoli sta in testa */
const isBack = (list: SectionIndexItem[], index: number): boolean => {
  const firstChapter = list.findIndex((s) => s.type === 'chapter')
  return firstChapter !== -1 && index > firstChapter
}

const rank = (list: SectionIndexItem[], index: number): number => {
  const type = list[index].type
  if (type === 'cover') return 0
  if (type === 'index') return 1
  if (type === 'chapter') return 3
  return isBack(list, index) ? 4 : 2
}

/** Nuovo elenco in ordine; dentro ogni gruppo le sezioni restano nell'ordine in cui erano */
export const orderSections = (sections: SectionIndexItem[]): SectionIndexItem[] =>
  sections.map((s, i) => ({ s, i, r: rank(sections, i) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ s }) => s)

/** Elenco con la nuova sezione al suo posto: una sezione senza numero va in fondo al gruppo scelto */
export const withNewSection = (sections: SectionIndexItem[], item: SectionIndexItem, place: 'front' | 'back' = 'front'): SectionIndexItem[] => {
  const list = orderSections(sections)
  if (!isFreeSection(item.type)) return orderSections([...list, item])
  const chapters = list.map((s, i) => (s.type === 'chapter' ? i : -1)).filter((i) => i !== -1)
  const at = !chapters.length ? list.length
    : place === 'front' ? chapters[0]
      : chapters[chapters.length - 1] + 1 + list.slice(chapters[chapters.length - 1] + 1).filter((s) => isFreeSection(s.type)).length
  return orderSections([...list.slice(0, at), item, ...list.slice(at)])
}

/**
 * Dove finisce una sezione trascinata su un'altra; null se lì non può andare.
 * - Capitoli: tra i capitoli; su copertina o indice diventano il primo capitolo.
 * - Sezioni senza numero: tra le altre sezioni senza numero, in testa o in fondo; su copertina o indice vanno
 *   prime in testa; sul primo capitolo (salendo) vanno ultime in testa, sull'ultimo (scendendo) prime in fondo.
 * Il valore è la posizione nell'elenco dopo aver tolto la sezione trascinata.
 */
export const dropTarget = (list: SectionIndexItem[], from: number, to: number): number | null => {
  if (from === to) return null
  const dragged = list[from].type
  const target = list[to].type
  const chapters = list.map((s, i) => (s.type === 'chapter' ? i : -1)).filter((i) => i !== -1)
  const afterHead = list.filter((s) => s.type === 'cover' || s.type === 'index').length
  const down = from < to

  if (dragged === 'chapter') {
    if (target === 'chapter') return to
    if (target === 'cover' || target === 'index') return chapters[0]
    return null
  }
  if (!isFreeSection(dragged)) return null
  if (isFreeSection(target)) return to
  if (target === 'cover' || target === 'index') return afterHead
  if (target === 'chapter') {
    if (down && to === chapters[chapters.length - 1]) return to        // tolta la sezione, l'ultimo capitolo scala di uno
    if (!down && to === chapters[0]) return to
  }
  return null
}

/** Sposta la sezione, se la regola lo permette. Restituisce true se l'elenco è cambiato. */
export const moveSection = (list: SectionIndexItem[], from: number, to: number): boolean => {
  const at = dropTarget(list, from, to)
  if (at === null) return false
  const [item] = list.splice(from, 1)
  list.splice(at, 0, item)
  const ordered = orderSections(list)
  list.splice(0, list.length, ...ordered)
  return true
}
