// Condivisione degli appunti come file .mtcbook: menu di condivisione del telefono, oppure download
import { buildMtcBook } from '../stores/book/mtcbookIO'
import { downloadBlob } from '../utils/download'
import { notesFileName, notesToPackage, type Note } from './notesModel'

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

export async function shareNotes(notes: Note[]): Promise<ShareOutcome> {
  const blob = await buildMtcBook(notesToPackage(notes))
  const name = notesFileName()
  const file = new File([blob], name, { type: 'application/octet-stream' })

  // Web Share con file: Android e iOS. Alcuni browser rifiutano i tipi sconosciuti: allora si scarica.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
      // Condivisione non riuscita (permesso negato, tipo non ammesso): si ripiega sul download
    }
  }
  downloadBlob(blob, name)
  return 'downloaded'
}
