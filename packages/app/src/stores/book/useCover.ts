// Copertina: modello attivo, anteprima dell'immagine di sfondo, asset in IndexedDB, HTML per il PDF
import { ref, type Ref } from 'vue'
import { getAsset, putAsset } from '../../db'
import {
  type BookCover, createEmptyCover, normalizeCover, coverToHtml, blobToDataUrl, newCoverId,
  COVER_EXT_BY_MIME, MAX_COVER_IMAGE_BYTES
} from '../../utils/cover'
import { getPageSizeMm } from '../../utils/pageFormats'
import { isCoverSection } from '../../utils/sectionOrder'
import type { BookMetadata, SectionIndexItem } from './types'

interface CoverDeps {
  sectionIndex: Ref<SectionIndexItem[]>
  activeSectionId: Ref<string | null>
  zippedSectionsCache: Ref<Record<string, string>>
  metadata: Ref<BookMetadata>
}

export function useCover({ sectionIndex, activeSectionId, zippedSectionsCache, metadata }: CoverDeps) {
  // Modello della copertina quando la sezione attiva è di tipo 'cover' (altrimenti null)
  const coverModel = ref<BookCover | null>(null)
  // URL temporaneo dell'immagine di sfondo, per l'anteprima nell'editor
  const coverImageUrl = ref<string | null>(null)
  let coverObjectUrl: string | null = null

  /** Copertina salvata di una sezione (dalla cache), sempre normalizzata */
  const cachedCover = (sectionId: string): BookCover => {
    try {
      return normalizeCover(JSON.parse(zippedSectionsCache.value[sectionId] || '{}').cover)
    } catch {
      return createEmptyCover()
    }
  }

  const clearCoverImageUrl = () => {
    if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl)
    coverObjectUrl = null
    coverImageUrl.value = null
  }

  async function refreshCoverImageUrl() {
    const id = coverModel.value?.image?.assetId
    if (!id) { clearCoverImageUrl(); return }

    const asset = await getAsset(id)
    // Nel frattempo l'immagine (o la sezione) può essere cambiata
    if (coverModel.value?.image?.assetId !== id) return
    if (!asset) { clearCoverImageUrl(); return }

    clearCoverImageUrl()
    coverObjectUrl = URL.createObjectURL(asset.blob)
    coverImageUrl.value = coverObjectUrl
  }

  /** Salva l'immagine scelta come asset e la collega alla copertina attiva */
  async function setCoverImage(file: File) {
    if (!coverModel.value) return
    if (!(file.type in COVER_EXT_BY_MIME)) throw new Error('Formato non supportato: usa PNG, JPEG o WebP.')
    if (file.size > MAX_COVER_IMAGE_BYTES) throw new Error('Immagine troppo grande (massimo 25 MB).')
    try {
      (await createImageBitmap(file)).close() // verifica che sia un'immagine leggibile
    } catch {
      throw new Error("Impossibile leggere l'immagine.")
    }

    const id = newCoverId('img')
    await putAsset({ id, blob: file, type: file.type, name: file.name })
    coverModel.value = { ...coverModel.value, image: { assetId: id, x: 50, y: 50, zoom: 1 } }
    await refreshCoverImageUrl()
  }

  async function removeCoverImage() {
    if (!coverModel.value) return
    coverModel.value = { ...coverModel.value, image: null }
    clearCoverImageUrl()
    // il file in IndexedDB viene eliminato al prossimo salvataggio
  }

  /** Identificativi delle immagini usate dalla copertina e dalla quarta di copertina */
  function collectAssetIds(): string[] {
    const ids = new Set<string>()
    for (const item of sectionIndex.value) {
      if (!isCoverSection(item.type)) continue
      const cover = item.id === activeSectionId.value ? coverModel.value : cachedCover(item.id)
      if (cover?.image) ids.add(cover.image.assetId)
    }
    return [...ids]
  }

  /** HTML della copertina pronto per il PDF (con l'immagine incorporata) */
  async function buildCoverHtml(sectionId: string): Promise<string> {
    const cover = sectionId === activeSectionId.value && coverModel.value
      ? coverModel.value
      : cachedCover(sectionId)

    let src: string | null = null
    if (cover.image) {
      const asset = await getAsset(cover.image.assetId)
      if (asset) src = await blobToDataUrl(asset.blob)
    }
    return coverToHtml(cover, src, getPageSizeMm(metadata.value.pageFormat))
  }

  return {
    coverModel, coverImageUrl,
    setCoverImage, removeCoverImage, refreshCoverImageUrl, clearCoverImageUrl,
    collectAssetIds, buildCoverHtml
  }
}
