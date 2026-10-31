// Lettura e scrittura del pacchetto .mtcbook (ZIP). Funzioni pure: non toccano lo store.
import JSZip from 'jszip'
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

export async function parseMtcBook(fileBuffer: ArrayBuffer | Blob): Promise<BookPackage> {
  const zip = await JSZip.loadAsync(fileBuffer)

  const bookJsonRaw = await zip.file('book.json')?.async('string')
  if (!bookJsonRaw) throw new Error('File book.json non trovato nell\'archivio.')
  const bookData = JSON.parse(bookJsonRaw)

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
  zip.file('book.json', JSON.stringify({ ...pkg.metadata, sectionIndex: pkg.sectionIndex }, null, 2))

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
