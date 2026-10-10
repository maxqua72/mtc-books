import Dexie, { type Table } from 'dexie'
import type { BookMetadata, SectionIndexItem } from '../stores/chessBookStore'

export interface LocalBookState {
  id: string // Sempre 'current_book'
  metadata: BookMetadata
  sectionIndex: SectionIndexItem[]
  activeSectionId: string | null
  updatedAt: string
}

export interface LocalSection {
  id: string
  json: string // Conserva la stringa JSON completa della sezione ({ id, html, trees })
}

export class MtcDatabase extends Dexie {
  bookState!: Table<LocalBookState>
  sections!: Table<LocalSection>

  constructor() {
    super('MtcBookDatabase')

    // Schema aggiornato: rimossa la tabella 'trees'
    this.version(2).stores({
      bookState: 'id',
      sections: 'id'
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
  zippedSectionsCache: Record<string, string>
) {
  await db.transaction('rw', db.bookState, db.sections, async () => {
    await db.bookState.put({
      id: 'current_book',
      metadata: JSON.parse(JSON.stringify(metadata)),
      sectionIndex: JSON.parse(JSON.stringify(sectionIndex)),
      activeSectionId,
      updatedAt: new Date().toISOString()
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
  })
}

/**
 * Svuota completamente il database locale IndexedDB
 */
export async function clearIndexedDB() {
  await db.bookState.clear()
  await db.sections.clear()
}