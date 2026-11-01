import { onBeforeUnmount, onMounted, watch } from 'vue'
import { platform } from '../platform'
import { useChessBookStore } from '../stores/chessBookStore'
import { autosaveError, autosavePaused, useBookFileActions } from './useBookFileActions'

export const FILE_AUTOSAVE_MS = 30_000

/** Salvataggio automatico del libro sul file associato (solo desktop, solo con la modifica abilitata) */
export function useFileAutosave(canWrite: () => boolean) {
  const store = useChessBookStore()
  const { saveToFile } = useBookFileActions()
  const enabled = !!platform.files.autosaveBook
  let timer: ReturnType<typeof setTimeout> | null = null
  let offClose: (() => void) | undefined

  const clear = () => { if (timer) { clearTimeout(timer); timer = null } }

  const eligible = () =>
    enabled && canWrite() && store.isBookLoaded && !store.isLocked &&
    !autosavePaused.value && !!platform.files.currentFile?.value

  async function flush() {
    clear()
    if (!eligible()) return
    const outcome = await saveToFile('auto')
    if (outcome === 'conflict') {
      autosavePaused.value = true
      alert('Il file è stato modificato da un altro programma dopo l’ultimo salvataggio di MTC Book.\n\nIl salvataggio automatico su file è sospeso per non sovrascrivere quelle modifiche. Usa «Salva Lavoro» o «Salva con nome» per scegliere come procedere.')
    }
  }

  /** Da chiamare a ogni modifica: il salvataggio parte dopo 30 secondi senza altre modifiche */
  const touch = () => {
    if (!enabled) return
    clear()
    timer = setTimeout(() => void flush(), FILE_AUTOSAVE_MS)
  }

  // Un nuovo file associato (apertura, nuovo libro, salvataggio riuscito): si riparte da zero
  watch(() => platform.files.currentFile?.value, () => {
    autosavePaused.value = false
    autosaveError.value = false
  })

  const onBlur = () => void flush()
  const onVisibility = () => { if (document.visibilityState === 'hidden') void flush() }

  onMounted(() => {
    if (!enabled) return
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    offClose = platform.files.onBeforeClose?.(flush)
  })
  onBeforeUnmount(() => {
    clear()
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibility)
    offClose?.()
  })

  return { touch, flush }
}