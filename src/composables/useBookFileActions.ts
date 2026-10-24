// Azioni dell'header sul file del libro: nuovo, apri, salva (.mtcbook)
import type { Ref } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { downloadBlob } from '../utils/download'

/** `fileInput`: l'<input type="file"> nascosto del componente, per aprire il selettore file */
export function useBookFileActions(fileInput: Ref<HTMLInputElement | null>) {
  const store = useChessBookStore()

  const triggerFileSelect = () => fileInput.value?.click()

  const handleNewBook = async () => {
    if (!confirm(store.fileDirty
      ? 'Il libro corrente ha modifiche non salvate su file (.mtcbook): se continui andranno perse. Creare un nuovo libro?'
      : 'Vuoi creare un nuovo libro?')) return
    await store.startNewBook('Nuovo Libro di Scacchi', 'Autore')
  }

  const handleOpenFile = async (event: Event) => {
    const target = event.target as HTMLInputElement
    if (!target.files || target.files.length === 0) return

    if (store.isBookLoaded &&
      !confirm(store.fileDirty
        ? 'Il libro corrente ha modifiche non salvate su file (.mtcbook): se continui andranno perse. Aprire un altro libro?'
        : 'Aprire un altro libro? Il libro corrente verrà sostituito.')) {
      target.value = ''
      return
    }

    try {
      await store.loadMtcBook(await target.files[0].arrayBuffer())
      alert(`Libro "${store.metadata.title}" caricato in sola lettura: usa l'interruttore in alto per modificarlo.`)
    } catch (error) {
      console.error(error)
      alert('Errore durante il caricamento del file .mtcbook')
    } finally {
      target.value = ''
    }
  }

  const handleSaveFile = async () => {
    window.dispatchEvent(new CustomEvent('request-editor-sync'))
    try {
      const blob = await store.exportMtcBook(store.activeSectionHtml)
      downloadBlob(blob, `${store.metadata.title.toLowerCase().replace(/\s+/g, '_')}.mtcbook`)
      await store.markFileSaved()
    } catch (error) {
      console.error(error)
      alert('Errore durante il salvataggio.')
    }
  }

  return { triggerFileSelect, handleNewBook, handleOpenFile, handleSaveFile }
}