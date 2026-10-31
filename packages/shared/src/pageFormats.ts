// Unica fonte dei formati di pagina del libro, usata da client, server e desktop
export interface PageSizeMm { width: number; height: number }

export const PAGE_FORMATS_MM: Record<string, PageSizeMm> = {
  a4: { width: 210, height: 297 },
  'crown-quarto': { width: 189, height: 246 },
  'b-format': { width: 129, height: 198 },
}

/** Formati che Chromium conosce per nome: nel PDF non si passano in millimetri */
export const NAMED_PAGE_FORMATS: readonly string[] = ['a4']