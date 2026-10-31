import { defineStore } from 'pinia'
import { ref } from 'vue'
import { platform } from '../platform'
import type { BookPdfRequest, ChapterPdfRequest } from '../shared/pdf'

// Riesportato: usePdfExport lo importa ancora da qui
export type { ExportSection } from '../shared/pdf'

export const usePdfStore = defineStore('pdf', () => {
  const isGeneratingPdf = ref(false)
  const error = ref<string | null>(null)

  const run = async (label: string, job: () => Promise<void>) => {
    isGeneratingPdf.value = true
    error.value = null
    try {
      await job()
    } catch (err: any) {
      console.error(`[PDF Store] ${label}:`, err)
      error.value = err.message
      throw err
    } finally {
      isGeneratingPdf.value = false
    }
  }

  const exportCurrentChapter = (payload: ChapterPdfRequest) =>
    run('Errore capitolo', () => platform.pdf.exportChapter(payload))

  const exportFullBook = (payload: BookPdfRequest) =>
    run('Errore libro completo', () => platform.pdf.exportBook(payload))

  return { isGeneratingPdf, error, exportCurrentChapter, exportFullBook }
})