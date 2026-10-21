import Dexie, { type Table } from 'dexie'
import type { BookMetadata, SectionIndexItem } from '../stores/chessBookStore'

export interface LocalBookState {
  id: string // Sempre 'current_book'
  metadata: BookMetadata
  sectionIndex: SectionIndexItem[]
  activeSectionId: string | null
  updatedAt: string
  dirtyVsFile?: boolean   // il lavoro nel browser è più recente dell'ultimo file .mtcbook salvato
}

export interface LocalSection {
  id: string
  json: string // Conserva la stringa JSON completa della sezione ({ id, html, trees })
}

export interface LocalAsset {
  id: string
  blob: Blob
  type: string
  name: string
}

// Impostazioni dell'applicazione (es. tema): vivono solo in questo browser, mai nel file .mtcbook
export interface LocalSetting {
  id: string
  value: unknown
}

export const putAsset = (asset: LocalAsset) => db.assets.put(asset)
export const getAsset = (id: string) => db.assets.get(id)

/** Elimina gli asset non più referenziati dal libro */
export async function pruneAssets(keepIds: string[]) {
  const keep = new Set(keepIds)
  const stale = (await db.assets.toCollection().primaryKeys()).filter(id => !keep.has(id as string))
  if (stale.length) await db.assets.bulkDelete(stale)
}

export class MtcDatabase extends Dexie {
  bookState!: Table<LocalBookState>
  sections!: Table<LocalSection>
  assets!: Table<LocalAsset>
  settings!: Table<LocalSetting>

  constructor() {
    super('MtcBookDatabase')

    // Schema aggiornato: rimossa la tabella 'trees'
    this.version(2).stores({
      bookState: 'id',
      sections: 'id',
      assets: 'id'
    })

    // Versione 3: tabella delle impostazioni dell'applicazione
    this.version(3).stores({
      bookState: 'id',
      sections: 'id',
      assets: 'id',
      settings: 'id'
    })
  }
}

export const db = new MtcDatabase()

/**
 * Salvataggio unico e centralizzato di tutto lo stato dell'applicazione
 */
export async function saveFullStateToIndexedDB(
  metadata: BookMetadata,
  sectionIndex: SectionIndexItem[],
  activeSectionId: string | null,
  zippedSectionsCache: Record<string, string>,
  keepAssetIds?: string[],
  dirtyVsFile?: boolean
) {
  await db.transaction('rw', db.bookState, db.sections, db.assets, async () => {
    await db.bookState.put({
      id: 'current_book',
      metadata: JSON.parse(JSON.stringify(metadata)),
      sectionIndex: JSON.parse(JSON.stringify(sectionIndex)),
      activeSectionId,
      updatedAt: new Date().toISOString(),
      dirtyVsFile
    })

    const validIds = new Set(sectionIndex.map(s => s.id))
    await db.sections.bulkPut(
      Object.entries(zippedSectionsCache)
        .filter(([id]) => validIds.has(id))
        .map(([id, json]) => ({ id, json }))
    )

    // rimuove le sezioni eliminate o di libri precedenti
    const stale = (await db.sections.toCollection().primaryKeys())
      .filter(id => !validIds.has(id as string))
    await db.sections.bulkDelete(stale)

    // rimuove le immagini non più referenziate (copertine sostituite o eliminate)
    if (keepAssetIds) {
      const keep = new Set(keepAssetIds)
      const staleAssets = (await db.assets.toCollection().primaryKeys())
        .filter(id => !keep.has(id as string))
      if (staleAssets.length) await db.assets.bulkDelete(staleAssets)
    }
  })
}

export const getSetting = async (id: string): Promise<unknown> => (await db.settings.get(id))?.value
export const putSetting = (id: string, value: unknown) => db.settings.put({ id, value })

/** Aggiorna solo l'indicatore "copia su disco non aggiornata" */
export async function setDirtyVsFile(flag: boolean) {
  await db.bookState.update('current_book', { dirtyVsFile: flag })
}

/**
 * Svuota completamente il database locale IndexedDB
 */
export async function clearIndexedDB() {
  await db.bookState.clear()
  await db.sections.clear()
  await db.assets.clear()
}