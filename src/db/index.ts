import Dexie, { type Table } from 'dexie'
import type { BookMetadata, SectionIndexItem } from '../stores/chessBookStore'
import type { ChessTree } from '../stores/chessTreeStore'

export interface LocalBookState {
  id: string // Sempre 'current_book'
  metadata: BookMetadata
  sectionIndex: SectionIndexItem[]
  activeSectionId: string | null
  updatedAt: string
}

export interface LocalSection {
  id: string
  html: string
}

export interface LocalTree {
  id: string
  data: ChessTree
}

export class MtcDatabase extends Dexie {
  bookState!: Table<LocalBookState>
  sections!: Table<LocalSection>
  trees!: Table<LocalTree>

  constructor() {
    super('MtcBookDatabase')
    this.version(1).stores({
      bookState: 'id',
      sections: 'id',
      trees: 'id'
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
  activeSectionHtml: string,
  trees: ChessTree[]
) {
  try {
    // 1. Salvataggio Metadati e Indice
    await db.bookState.put({
      id: 'current_book',
      metadata: JSON.parse(JSON.stringify(metadata)),
      sectionIndex: JSON.parse(JSON.stringify(sectionIndex)),
      activeSectionId,
      updatedAt: new Date().toISOString()
    })

    // 2. Preparazione delle Sezioni / Capitoli
    const cacheCopy = { ...zippedSectionsCache }
    if (activeSectionId) {
      cacheCopy[activeSectionId] = JSON.stringify({
        id: activeSectionId,
        html: activeSectionHtml
      })
    }

    const sectionsToSave: LocalSection[] = Object.entries(cacheCopy).map(([id, rawJson]) => {
      try {
        const parsed = JSON.parse(rawJson)
        return { id, html: parsed.html || '' }
      } catch {
        return { id, html: '' }
      }
    })

    if (sectionsToSave.length > 0) {
      await db.sections.bulkPut(sectionsToSave)
    }

    // 3. Salvataggio Alberi Scacchistici
    const treesToSave: LocalTree[] = trees.map(t => ({
      id: t.id,
      data: JSON.parse(JSON.stringify(t))
    }))

    if (treesToSave.length > 0) {
      await db.trees.bulkPut(treesToSave)
    }
  } catch (error) {
    console.error('[Dexie] Errore durante il salvataggio globale:', error)
  }
}

export async function clearIndexedDB() {
  await db.bookState.clear()
  await db.sections.clear()
  await db.trees.clear()
}