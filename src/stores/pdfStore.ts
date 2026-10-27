import { defineStore } from 'pinia'
import { ref } from 'vue'
import { downloadBlob } from '../utils/download'

export interface ExportSection {
  id: string
  title: string
  type: string
  chapterNumber?: number
  html: string
}

const CHAPTER_TIMEOUT_MS = 2 * 60_000
const BOOK_TIMEOUT_MS = 10 * 60_000

export const usePdfStore = defineStore('pdf', () => {
  const isGeneratingPdf = ref(false)
  const error = ref<string | null>(null)

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

  /** POST JSON al server PDF e restituisce il PDF; il timeout copre anche la lettura della risposta */
  const requestPdf = async (path: string, body: unknown, timeoutMs: number, failureMessage: string): Promise<Blob> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`${failureMessage} ${detail}`.trim())
      }
      return await response.blob()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Il server PDF non ha risposto entro ${Math.round(timeoutMs / 60_000)} minuti.`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * 1. Esporta il singolo capitolo attivo
   */
  const exportCurrentChapter = async (payload: {
    htmlContent: string
    customCss: string
    title: string
    chapterNumber?: number
    pageSize?: string
  }) => {
    isGeneratingPdf.value = true
    error.value = null

    try {
      const blob = await requestPdf('/api/pdf/generate', {
        htmlContent: payload.htmlContent,
        customCss: payload.customCss,
        chapterNumber: payload.chapterNumber || 1,
        pageSize: payload.pageSize || 'A4'
      }, CHAPTER_TIMEOUT_MS, 'Errore nella generazione del capitolo PDF.')
      downloadBlob(blob, `${payload.title.toLowerCase().replace(/\s+/g, '_')}.pdf`)
    } catch (err: any) {
      console.error('[PDF Store] Errore capitolo:', err)
      error.value = err.message
      throw err
    } finally {
      isGeneratingPdf.value = false
    }
  }

  /**
   * 2. Esporta l'intero libro (assemblato lato server)
   */
  const exportFullBook = async (payload: {
    sections: ExportSection[]
    customCss: string
    bookTitle: string
    pageSize?: string
  }) => {
    isGeneratingPdf.value = true
    error.value = null

    try {
      const blob = await requestPdf('/api/pdf/generate-book', {
        sections: payload.sections,
        customCss: payload.customCss,
        bookTitle: payload.bookTitle,
        pageSize: payload.pageSize || 'A4'
      }, BOOK_TIMEOUT_MS, 'Errore nella generazione del libro completo.')
      downloadBlob(blob, `${payload.bookTitle.toLowerCase().replace(/\s+/g, '_')}_completo.pdf`)
    } catch (err: any) {
      console.error('[PDF Store] Errore libro completo:', err)
      error.value = err.message
      throw err
    } finally {
      isGeneratingPdf.value = false
    }
  }

  return {
    isGeneratingPdf,
    error,
    exportCurrentChapter,
    exportFullBook
  }
})