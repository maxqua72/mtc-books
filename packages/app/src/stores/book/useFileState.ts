// Sola lettura e stato della copia su disco (.mtcbook)
import { ref, type Ref } from 'vue'
import { setDirtyVsFile } from '../../db'
import { extractTreeIds } from '../../utils/html'
import { isGeneratedSection } from '../../utils/sectionOrder'
import type { BookMetadata, SectionIndexItem } from './types'

interface FileStateDeps {
  metadata: Ref<BookMetadata>
  sectionIndex: Ref<SectionIndexItem[]>
  zippedSectionsCache: Ref<Record<string, string>>
}

export function useFileState({ metadata, sectionIndex, zippedSectionsCache }: FileStateDeps) {
  // Un libro aperto da file o ripristinato è in sola lettura; uno nuovo è subito modificabile.
  const isLocked = ref(true)
  // true = il lavoro nel browser (IndexedDB) differisce dall'ultimo file .mtcbook salvato o caricato
  const fileDirty = ref(false)
  let fileBaselineSig: string | null = null   // null = linea di base sconosciuta: resta "da salvare" fino al prossimo salvataggio

  const setLocked = (value: boolean) => { isLocked.value = value }

  /**
   * Impronta del contenuto che finisce nel file: metadati (senza date), indice, e per ogni sezione
   * html, alberi usati e copertina. Esclusi lo stato di navigazione (nodo attivo) e gli alberi orfani,
   * così spostarsi tra le mosse o l'autosave non contano come modifiche.
   */
  function contentSignature(): string {
    const meta: Record<string, unknown> = { ...metadata.value }
    delete meta.createdAt
    delete meta.updatedAt
    delete meta.revision
    delete meta.savedAt
    delete meta.savedBy

    const sections = sectionIndex.value.map(item => {
      let body: unknown = null
      if (item.type === 'index' || isGeneratedSection(item.type)) return [item.id, item.type, item.title, null]
      try {
        const p = JSON.parse(zippedSectionsCache.value[item.id] || '{}')
        const html: string = typeof p.html === 'string' ? p.html : ''
        const used = new Set(extractTreeIds(html))
        const trees = (Array.isArray(p.trees) ? p.trees : [])
          .filter((t: any) => used.has(t?.id))
          .map((t: any) => {
            const copy = { ...t }
            delete copy.activeNodeId
            return copy
          })
        body = { html, trees, cover: p.cover ?? null }
      } catch { body = null }
      return [item.id, item.type, item.title, item.syncTitle !== false, body]
    })
    return JSON.stringify([meta, sections])
  }

  /** dirty = true: la linea di base è ignota (libro mai salvato su file). dirty = false: lo stato attuale coincide col file. */
  function resetFileBaseline(dirty: boolean) {
    fileDirty.value = dirty
    fileBaselineSig = dirty ? null : contentSignature()
  }

  function refreshFileDirty() {
    if (fileBaselineSig !== null) fileDirty.value = contentSignature() !== fileBaselineSig
  }

  /** Da chiamare dopo aver scritto il file .mtcbook */
  async function markFileSaved() {
    fileBaselineSig = contentSignature()
    fileDirty.value = false
    try { await setDirtyVsFile(false) } catch (e) { console.error(e) }
  }

  return { isLocked, fileDirty, setLocked, resetFileBaseline, refreshFileDirty, markFileSaved }
}
