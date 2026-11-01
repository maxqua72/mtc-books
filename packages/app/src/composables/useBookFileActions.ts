import { ref } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { platform } from '../platform'
import type { PickedBook } from '../platform/types'

export type SaveOutcome = 'saved' | 'cancelled' | 'conflict' | 'no-file' | 'unchanged' | 'error'

// Stato condiviso tra intestazione e salvataggio automatico
export const autosavePaused = ref(false) // dopo un conflitto: il file è cambiato per mano di altri
export const autosaveError = ref(false)  // l'ultimo salvataggio automatico non è riuscito

// Un salvataggio alla volta: manuale, automatico e di chiusura non si sovrappongono
let queue: Promise<unknown> = Promise.resolve()
const serialize = <T>(job: () => Promise<T>): Promise<T> => {
  const run = queue.then(job, job)
  queue = run.catch(() => undefined)
  return run
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('it-IT') : 'data sconosciuta')

export function useBookFileActions() {
  const store = useChessBookStore()

  const fileName = () => `${store.metadata.title.toLowerCase().replace(/\s+/g, '_')}.mtcbook`

  const handleNewBook = async () => {
    if (!confirm(store.fileDirty
      ? 'Il libro corrente ha modifiche non salvate su file (.mtcbook): se continui andranno perse. Creare un nuovo libro?'
      : 'Vuoi creare un nuovo libro?')) return
    await store.startNewBook('Nuovo Libro di Scacchi', 'Autore')
  }

  /** Testo della conferma prima di sostituire il libro aperto (null = nessuna conferma) */
  const confirmationFor = async (picked: PickedBook): Promise<string | null> => {
    if (!store.isBookLoaded) return null
    const peek = await store.peekBookFile(picked.data)
    const sameBook = !!peek?.bookId && peek.bookId === store.metadata.bookId

    if (sameBook && peek.revision < (store.metadata.revision ?? 0)) {
      return `ATTENZIONE: il file che stai aprendo è una versione PIÙ VECCHIA dello stesso libro (salvata il ${fmt(peek.savedAt)}) rispetto a quello aperto ora (salvato il ${fmt(store.metadata.savedAt)}). Aprirlo sostituirà il libro corrente. Continuare?`
    }
    if (sameBook && store.fileDirty) {
      return 'Il file è una copia dello stesso libro, ma il libro aperto ora ha modifiche non salvate su file: se continui andranno perse. Per conservarle, annulla e usa «Salva con nome». Continuare?'
    }
    return store.fileDirty
      ? 'Il libro corrente ha modifiche non salvate su file (.mtcbook): se continui andranno perse. Aprire un altro libro?'
      : 'Aprire un altro libro? Il libro corrente verrà sostituito.'
  }

  /** Carica un libro già letto (dal selettore o aperto dal sistema) */
  const openPicked = async (picked: PickedBook) => {
    const question = await confirmationFor(picked)
    if (question && !confirm(question)) return

    try {
      await store.loadMtcBook(picked.data)
      platform.files.commitOpen?.(picked.name)
      alert(`Libro "${store.metadata.title}" caricato in sola lettura: usa l'interruttore in alto per modificarlo.`)
    } catch (error) {
      console.error(error)
      alert('Errore durante il caricamento del file .mtcbook')
    }
  }

  const handleOpenFile = async () => {
    const picked = await platform.files.pickBook() // prima istruzione: resta dentro il gesto dell'utente
    if (picked) await openPicked(picked)
  }

  /** Unico percorso di salvataggio. 'auto' non mostra mai dialoghi né alert. */
  const saveToFile = (mode: 'manual' | 'auto' | 'as'): Promise<SaveOutcome> => serialize(async () => {
    window.dispatchEvent(new CustomEvent('request-editor-sync'))
    try {
      if (mode === 'auto') {
        // Si controlla qui, in coda: un salvataggio manuale appena concluso rende inutile questo
        store.syncActiveSectionToCache()
        store.refreshFileDirty()
        if (!store.fileDirty) return 'unchanged'
      }

      const blob = await store.exportMtcBook(store.activeSectionHtml)
      const name = fileName()
      let outcome: SaveOutcome

      if (mode === 'auto') {
        const result = await platform.files.autosaveBook!(blob, name)
        outcome = result
        autosaveError.value = result === 'error'
      } else if (mode === 'as') {
        outcome = (await platform.files.saveBookAs!(blob, name)) ? 'saved' : 'cancelled'
      } else {
        outcome = (await platform.files.saveBook(blob, name)) ? 'saved' : 'cancelled'
      }

      if (outcome === 'saved') await store.markFileSaved()
      return outcome
    } catch (error) {
      console.error(error)
      if (mode === 'auto') { autosaveError.value = true; return 'error' }
      alert('Errore durante il salvataggio.')
      return 'error'
    }
  })

  const handleSaveFile = () => saveToFile('manual')
  const handleSaveAs = () => saveToFile('as')

  return { handleNewBook, handleOpenFile, handleSaveFile, handleSaveAs, openPicked, saveToFile }
}