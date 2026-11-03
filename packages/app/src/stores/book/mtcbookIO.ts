// Lettura e scrittura del pacchetto .mtcbook (ZIP). Funzioni pure: non toccano lo store.
import JSZip from 'jszip'
import { BOOK_FORMAT_VERSION, BOOK_TOO_NEW_MESSAGE, isBookTooNew } from '@mtc/shared'
import { sanitizeSectionIndex } from '../../utils/sanitize'
import { COVER_EXT_BY_MIME, COVER_MIME_BY_EXT } from '../../utils/cover'
import { normalizeMetadata, type BookMetadata, type SectionIndexItem } from './types'

export interface BookAsset { id: string; blob: Blob; type: string }

export interface BookPackage {
  metadata: BookMetadata
  sectionIndex: SectionIndexItem[]
  sections: Record<string, string>   // id sezione -> JSON grezzo, non analizzato
  assets: BookAsset[]
}

export class BookTooNewError extends Error {
  constructor() { super(BOOK_TOO_NEW_MESSAGE) }
}

export async function parseMtcBook(fileBuffer: ArrayBuffer | Blob): Promise<BookPackage> {
  const zip = await JSZip.loadAsync(fileBuffer)

  const bookJsonRaw = await zip.file('book.json')?.async('string')
  if (!bookJsonRaw) throw new Error('File book.json non trovato nell\'archivio.')
  const bookData = JSON.parse(bookJsonRaw)
  if (isBookTooNew(bookData)) throw new BookTooNewError()   // salvandolo si perderebbero i dati che non conosciamo

  const metadata = normalizeMetadata(bookData)
  const sectionIndex = sanitizeSectionIndex(bookData.sectionIndex)

  // Le sezioni restano stringhe JSON: si analizzano solo all'apertura del capitolo
  const sections: Record<string, string> = {}
  const sectionsFolder = zip.folder('sections')
  if (sectionsFolder) {
    for (const item of sectionIndex) {
      const file = sectionsFolder.file(`${item.id}.json`)
      if (file) sections[item.id] = await file.async('string')
    }
  }

  // Immagini della copertina
  const assets: BookAsset[] = []
  const assetsFolder = zip.folder('assets')
  if (assetsFolder) {
    const entries: { id: string; file: JSZip.JSZipObject; type: string }[] = []
    assetsFolder.forEach((relativePath, file) => {
      if (file.dir) return
      const m = /^([\w-]{1,64})\.(png|jpg|jpeg|webp)$/i.exec(relativePath)
      if (m) entries.push({ id: m[1], file, type: COVER_MIME_BY_EXT[m[2].toLowerCase()] })
    })
    for (const e of entries) {
      const data = await e.file.async('arraybuffer')
      assets.push({ id: e.id, blob: new Blob([data], { type: e.type }), type: e.type })
    }
  }

  return { metadata, sectionIndex, sections, assets }
}

export async function buildMtcBook(pkg: BookPackage): Promise<Blob> {
  const zip = new JSZip()
  zip.file('book.json', JSON.stringify({ ...pkg.metadata, formatVersion: BOOK_FORMAT_VERSION, sectionIndex: pkg.sectionIndex }, null, 2))

  // Solo le sezioni presenti nell'indice
  const sectionsFolder = zip.folder('sections')
  if (sectionsFolder) {
    for (const item of pkg.sectionIndex) {
      const json = pkg.sections[item.id]
      if (json) sectionsFolder.file(`${item.id}.json`, json)
    }
  }

  const assetsFolder = zip.folder('assets')
  if (assetsFolder) {
    for (const a of pkg.assets) assetsFolder.file(`${a.id}.${COVER_EXT_BY_MIME[a.type] ?? 'png'}`, a.blob)
  }

  return await zip.generateAsync({ type: 'blob' })
}

export interface BookPeek {
  bookId: string | null
  revision: number
  savedAt: string | null
  title: string
  tooNew: boolean   // formato più recente di quello supportato
}

/** Legge solo book.json: serve a confrontare un file con il libro aperto prima di sostituirlo */
export async function peekMtcBook(fileBuffer: ArrayBuffer | Blob): Promise<BookPeek | null> {
  try {
    const zip = await JSZip.loadAsync(fileBuffer)
    const raw = JSON.parse((await zip.file('book.json')?.async('string')) ?? '')
    return {
      bookId: typeof raw.bookId === 'string' && /^[\w-]{1,80}$/.test(raw.bookId) ? raw.bookId : null,
      revision: Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0,
      savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : null,
      title: typeof raw.title === 'string' ? raw.title : '',
      tooNew: isBookTooNew(raw),
    }
  } catch {
    return null
  }
}
