// Avviso non bloccante in basso: un messaggio alla volta, con un'azione facoltativa (es. «Annulla»)
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface NoticeAction {
  label: string
  run: () => void
}

export interface Notice {
  id: number
  message: string
  detail?: string
  action?: NoticeAction
}

const DEFAULT_DURATION_MS = 10_000

export const useNoticeStore = defineStore('notice', () => {
  const current = ref<Notice | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0

  const dismiss = () => {
    if (timer) clearTimeout(timer)
    timer = null
    current.value = null
  }

  /** Mostra un avviso al posto di quello precedente. Restituisce l'id, per chiuderlo solo se è ancora lui. */
  const show = (notice: Omit<Notice, 'id'>, durationMs = DEFAULT_DURATION_MS): number => {
    dismiss()
    const id = ++seq
    current.value = { ...notice, id }
    timer = setTimeout(() => { if (current.value?.id === id) dismiss() }, durationMs)
    return id
  }

  const runAction = () => {
    const action = current.value?.action
    dismiss()
    action?.run()
  }

  return { current, show, dismiss, runAction }
})
