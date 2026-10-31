// Formati di pagina del libro (lato client). La tabella dei millimetri sta in @mtc/shared.
import { PAGE_FORMATS_MM, type PageSizeMm } from '@mtc/shared'

export { PAGE_FORMATS_MM }
export type { PageSizeMm }

export const MM_TO_PX = 96 / 25.4

export const getPageSizeMm = (format?: string): PageSizeMm =>
  PAGE_FORMATS_MM[format || 'a4'] ?? PAGE_FORMATS_MM.a4

/** { width: '210mm', height: '297mm' } per le variabili CSS --page-width / --page-height */
export const getPageSizeCss = (format?: string): { width: string; height: string } => {
  const { width, height } = getPageSizeMm(format)
  return { width: `${width}mm`, height: `${height}mm` }
}

/** Dimensioni in px a 96 DPI (arrotondate) */
export const getPagePx = (format?: string): PageSizeMm => {
  const { width, height } = getPageSizeMm(format)
  return { width: Math.round(width * MM_TO_PX), height: Math.round(height * MM_TO_PX) }
}