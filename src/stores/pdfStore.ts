import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePdfStore = defineStore('pdf', () => {
  const isGeneratingPdf = ref(false)
  const error = ref<string | null>(null)

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

  // Helper privato per scaricare il Blob ricevuto dal backend
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  /**
   * 1. Esporta il singolo capitolo attivo
   */
  const exportCurrentChapter = async (payload: {
    htmlContent: string
    customCss: string
    title: string
    pageSize?: string
  }) => {
    isGeneratingPdf.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE_URL}/api/pdf/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent: payload.htmlContent,
          customCss: payload.customCss,
          pageSize: payload.pageSize || 'A4'
        })
      })

      if (!response.ok) throw new Error('Errore nella generazione del capitolo PDF.')

      const blob = await response.blob()
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
    sections: Array<{ id: string; title: string; type: string; html: string }>
    customCss: string
    bookTitle: string
    pageSize?: string
  }) => {
    isGeneratingPdf.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE_URL}/api/pdf/generate-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: payload.sections,
          customCss: payload.customCss,
          bookTitle: payload.bookTitle,
          pageSize: payload.pageSize || 'A4'
        })
      })

      if (!response.ok) throw new Error('Errore nella generazione del libro completo.')

      const blob = await response.blob()
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