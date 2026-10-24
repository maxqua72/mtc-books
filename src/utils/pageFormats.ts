// Unica fonte per i formati di pagina del libro (lato client).
// Prima c'erano tabelle separate in cover.ts e BookEditor.vue (mm, stringhe CSS e px).
// Il server (pdfEngine.ts) ha ancora la sua tabella: si allinea nella fase dedicata.

export const MM_TO_PX = 96 / 25.4

export interface PageSizeMm { width: number; height: number }

export const PAGE_FORMATS_MM: Record<string, PageSizeMm> = {
  a4: { width: 210, height: 297 },
  'crown-quarto': { width: 189, height: 246 },
  'b-format': { width: 129, height: 198 },
}

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
