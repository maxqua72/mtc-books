import { downloadBlob } from '../../utils/download'
import type { PdfPlatform } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
const CHAPTER_TIMEOUT_MS = 2 * 60_000
const BOOK_TIMEOUT_MS = 10 * 60_000

/** POST JSON al server PDF e restituisce il PDF; il timeout copre anche la lettura della risposta */
async function requestPdf(path: string, body: unknown, timeoutMs: number, failureMessage: string): Promise<Blob> {
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

const fileName = (title: string) => title.toLowerCase().replace(/\s+/g, '_')

export const webPdf: PdfPlatform = {
  async exportChapter(req) {
    const blob = await requestPdf('/api/pdf/generate', {
      htmlContent: req.htmlContent,
      customCss: req.customCss,
      chapterNumber: req.chapterNumber || 1,
      pageSize: req.pageSize || 'A4',
      outerPageNumbers: req.outerPageNumbers === true
    }, CHAPTER_TIMEOUT_MS, 'Errore nella generazione del capitolo PDF.')
    downloadBlob(blob, `${fileName(req.title)}.pdf`)
  },

  async exportBook(req) {
    const blob = await requestPdf('/api/pdf/generate-book', {
      sections: req.sections,
      customCss: req.customCss,
      bookTitle: req.bookTitle,
      pageSize: req.pageSize || 'A4',
      outerPageNumbers: req.outerPageNumbers === true
    }, BOOK_TIMEOUT_MS, 'Errore nella generazione del libro completo.')
    downloadBlob(blob, `${fileName(req.bookTitle)}_completo.pdf`)
  }
}