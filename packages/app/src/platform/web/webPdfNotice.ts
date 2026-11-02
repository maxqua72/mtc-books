import type { PdfPlatform } from '../types'
import { showPdfDesktopNotice } from '../pdfNotice'

export const webPdfNotice: PdfPlatform = {
  async exportChapter() { showPdfDesktopNotice() },
  async exportBook() { showPdfDesktopNotice() },
}