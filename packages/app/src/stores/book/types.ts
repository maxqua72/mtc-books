import { newUuid } from '../../utils/ids'
// Tipi e valori predefiniti del libro
export type SectionType = 'cover' | 'index' | 'chapter'
export type PageFormat = 'a4' | 'crown-quarto' | 'b-format'
export type SaveStatus = 'saved' | 'saving' | 'unsaved'

export interface SectionIndexItem {
  id: string
  type: SectionType
  title: string
  syncTitle?: boolean   // solo capitoli: false = il nome non segue il primo titolo (assente = segue)
}

export interface BookMetadata {
  bookId: string                 // identità stabile del libro: serve a riconoscere copie divergenti
  revision: number               // quante volte il libro è stato salvato su file
  savedAt?: string               // data dell'ultimo salvataggio su file
  savedBy?: 'web' | 'desktop'
  version: string
  title: string
  author: string
  createdAt: string
  updatedAt: string
  pageFormat: PageFormat
  isTwoColumns: boolean
  showNumbering: boolean
  pageMarginTop: number
  pageMarginRight: number
  pageMarginBottom: number
  pageMarginLeft: number
  paragraphSpacing: number   // mm: tra due paragrafi
  diagramSpacing: number     // mm: sopra e sotto i diagrammi
  variationSpacing: number   // mm: sopra e sotto i blocchi di partita/varianti
}

export const defaultMetadata = (): BookMetadata => ({
  bookId: newUuid('bk'), 
  revision: 0,
  version: '1.0.0',
  title: 'Nuovo Libro di Scacchi',
  author: 'Autore',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pageFormat: 'a4',
  isTwoColumns: false,
  showNumbering: true,
  pageMarginTop: 25,
  pageMarginRight: 20,
  pageMarginBottom: 25,
  pageMarginLeft: 20,
  paragraphSpacing: 4.5,
  diagramSpacing: 5,
  variationSpacing: 4
})

/** Metadati da un book.json (anche di versioni vecchie): i campi mancanti prendono i valori predefiniti */
export function normalizeMetadata(raw: any): BookMetadata {
  const d = defaultMetadata()
  const num = (v: unknown, def: number) => (v !== undefined ? Number(v) : def)
  return {
    bookId: typeof raw.bookId === 'string' && /^[\w-]{1,80}$/.test(raw.bookId) ? raw.bookId : newUuid('bk'),
    revision: Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : undefined,
    savedBy: raw.savedBy === 'web' || raw.savedBy === 'desktop' ? raw.savedBy : undefined,
    version: raw.version ?? d.version,
    title: raw.title ?? d.title,
    author: raw.author ?? d.author,
    createdAt: raw.createdAt ?? d.createdAt,
    updatedAt: raw.updatedAt ?? d.updatedAt,
    pageFormat: raw.pageFormat || 'a4',
    isTwoColumns: raw.isTwoColumns || false,
    showNumbering: raw.showNumbering !== undefined ? raw.showNumbering : true,
    pageMarginTop: num(raw.pageMarginTop, d.pageMarginTop),
    pageMarginRight: num(raw.pageMarginRight, d.pageMarginRight),
    pageMarginBottom: num(raw.pageMarginBottom, d.pageMarginBottom),
    pageMarginLeft: num(raw.pageMarginLeft, d.pageMarginLeft),
    paragraphSpacing: num(raw.paragraphSpacing, d.paragraphSpacing),
    diagramSpacing: num(raw.diagramSpacing, d.diagramSpacing),
    variationSpacing: num(raw.variationSpacing, d.variationSpacing)
  }
}
