// Unica tabella dei formati non standard lato PDF.
// Deve restare allineata a PAGE_FORMATS_MM del client (src/utils/pageFormats.ts); in fase 3 diventa un'unica fonte.
export interface CustomPageSize { width: string; height: string }

export const CUSTOM_PAGE_SIZES: Record<string, CustomPageSize> = {
  'crown-quarto': { width: '189mm', height: '246mm' },
  'b-format': { width: '129mm', height: '198mm' },
}

// I formati standard (A4, Letter...) restano affidati a Chromium: non si passa ad A4 in millimetri
// in questa fase, perché le dimensioni differiscono di frazioni di millimetro e potrebbero cambiare l'impaginazione.
export function pdfPageOptions(pageSize: string): { format?: string; width?: string; height?: string } {
  const custom = CUSTOM_PAGE_SIZES[pageSize.toLowerCase()]
  return custom ? { width: custom.width, height: custom.height } : { format: pageSize }
}