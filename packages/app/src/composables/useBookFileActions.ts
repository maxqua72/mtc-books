// Azioni dell'header sul file del libro: nuovo, apri, salva (.mtcbook)
import { useChessBookStore } from '../stores/chessBookStore'
import { platform } from '../platform'

export function useBookFileActions() {
  const store = useChessBookStore()

  const handleNewBook = async () => {
    if (!confirm(store.fileDirty
      ? 'Il libro corrente ha modifiche non salvate su file (.mtcbook): se continui andranno perse. Creare un nuovo libro?'
      : 'Vuoi creare un nuovo libro?')) return
    await store.startNewBook('Nuovo Libro di Scacchi', 'Autore')
  }

  const handleOpenFile = async () => {
    const picked = await platform.files.pickBook()   // prima istruzione: resta dentro il gesto dell'utente
    if (!picked) return

    if (store.isBookLoaded &&
      !confirm(store.fileDirty
        ? 'Il libro corrente ha modifiche non salvate su file (.mtcbook): se continui andranno perse. Aprire un altro libro?'
        : 'Aprire un altro libro? Il libro corrente verrà sostituito.')) return

    try {
      await store.loadMtcBook(picked.data)
      alert(`Libro "${store.metadata.title}" caricato in sola lettura: usa l'interruttore in alto per modificarlo.`)
    } catch (error) {
      console.error(error)
      alert('Errore durante il caricamento del file .mtcbook')
    }
  }

  const handleSaveFile = async () => {
    window.dispatchEvent(new CustomEvent('request-editor-sync'))
    try {
      const blob = await store.exportMtcBook(store.activeSectionHtml)
      await platform.files.saveBook(blob, `${store.metadata.title.toLowerCase().replace(/\s+/g, '_')}.mtcbook`)
      await store.markFileSaved()
    } catch (error) {
      console.error(error)
      alert('Errore durante il salvataggio.')
    }
  }

  return { handleNewBook, handleOpenFile, handleSaveFile }
}