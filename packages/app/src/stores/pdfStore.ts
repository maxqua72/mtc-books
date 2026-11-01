import { defineStore } from 'pinia'
import { ref } from 'vue'
import { platform } from '../platform'
import type { BookPdfRequest, ChapterPdfRequest } from '@mtc/shared'

export type { ExportSection } from '@mtc/shared'

export const usePdfStore = defineStore('pdf', () => {
  const isGeneratingPdf = ref(false)
  const error = ref<string | null>(null)
  const progress = ref<string | null>(null)
  const canCancel = !!platform.pdf.cancel

  const run = async (label: string, job: () => Promise<void>) => {
    isGeneratingPdf.value = true
    error.value = null
    const unsubscribe = platform.pdf.onProgress?.((text) => { progress.value = text })
    try {
      await job()
    } catch (err: any) {
      console.error(`[PDF Store] ${label}:`, err)
      error.value = err.message
      throw err
    } finally {
      unsubscribe?.()
      progress.value = null
      isGeneratingPdf.value = false
    }
  }

  const exportCurrentChapter = (payload: ChapterPdfRequest) =>
    run('Errore capitolo', () => platform.pdf.exportChapter(payload))

  const exportFullBook = (payload: BookPdfRequest) =>
    run('Errore libro completo', () => platform.pdf.exportBook(payload))

  const cancel = () => platform.pdf.cancel?.()

  return { isGeneratingPdf, error, progress, canCancel, exportCurrentChapter, exportFullBook, cancel }
})