// Appunti sul PC: importazione del file condiviso dal telefono e inserimento nel libro aperto
import { listNotes, putNote, putNotes } from '../db'
import { parseMtcBook } from '../stores/book/mtcbookIO'
import { useChessBookStore } from '../stores/chessBookStore'
import { sanitizeTrees } from '../utils/sanitize'
import { isContentSection } from '../utils/sectionOrder'
import { chapterHtml, mergeImportedNotes, noteTitle, packageToNotes, prepareNoteForBook, type Note } from './notesModel'

/** Evento ascoltato dall'editor del libro (useBookEditor): inserisce HTML e alberi al cursore */
export const INSERT_NOTE_EVENT = 'insert-note'
export interface InsertNoteDetail { html: string; trees: ReturnType<typeof prepareNoteForBook>['trees'] }

export async function importNotesFile(data: ArrayBuffer | Blob): Promise<{ added: number; updated: number }> {
  const incoming = packageToNotes(await parseMtcBook(data), sanitizeTrees)
  if (!incoming.length) throw new Error('Il file non contiene appunti né capitoli.')
  const { notes, added, updated } = mergeImportedNotes(await listNotes(), incoming)
  await putNotes(notes)
  return { added, updated }
}

/** Perché ora non si può inserire nel libro (null = si può) */
export function insertBlockedReason(): string | null {
  const store = useChessBookStore()
  if (!store.isBookLoaded) return 'Apri o crea un libro per inserire gli appunti.'
  if (store.isLocked) return 'Il libro è in sola lettura: passa a «Modifica attiva» per inserire gli appunti.'
  return null
}

/** Al cursore serve anche un capitolo o una sezione di testo aperti nell'editor */
export function cursorBlockedReason(): string | null {
  const store = useChessBookStore()
  return insertBlockedReason()
    ?? (isContentSection(store.activeSectionInfo?.type) ? null : 'Apri un capitolo per inserire l\'appunto al cursore.')
}

async function markInserted(note: Note): Promise<Note> {
  const { metadata } = useChessBookStore()
  const insertedIn = [
    ...(note.insertedIn ?? []).filter(i => i.bookId !== metadata.bookId),
    { bookId: metadata.bookId, title: metadata.title, at: new Date().toISOString() },
  ]
  const updated = { ...note, insertedIn }
  await putNote(updated)
  return updated
}

export async function insertNoteAtCursor(note: Note): Promise<Note | null> {
  if (cursorBlockedReason()) return null
  const detail: InsertNoteDetail = prepareNoteForBook(note)
  window.dispatchEvent(new CustomEvent<InsertNoteDetail>(INSERT_NOTE_EVENT, { detail }))
  return markInserted(note)
}

export async function insertNoteAsSection(note: Note): Promise<Note | null> {
  if (insertBlockedReason()) return null
  const store = useChessBookStore()
  const { html, trees } = prepareNoteForBook(note)
  window.dispatchEvent(new CustomEvent('request-editor-sync'))   // il capitolo aperto si congela aggiornato
  const id = store.createNewSection(noteTitle(note), 'chapter')
  store.zippedSectionsCache[id] = JSON.stringify({ id, html: chapterHtml({ title: note.title, html }), trees })
  await store.changeActiveSection(id, store.activeSectionHtml)
  return markInserted(note)
}
