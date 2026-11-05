import { MM_TO_PX } from './pageFormats'

export type DiagramSizeLevel = 'small' | 'medium' | 'large'

// Lato delle 8 caselle in mm, per formato di pagina
const PLAYING_AREA_MM: Record<string, Record<DiagramSizeLevel, number>> = {
  'a4': { small: 36, medium: 42, large: 48 },
  'crown-quarto': { small: 34, medium: 40, large: 45 },
  'b-format': { small: 28, medium: 32, large: 36 },
}

// Larghezza di un carattere del font Chess Merida, in em.
// Se la misura in console dà un valore diverso da 1, correggilo qui.
export const MERIDA_ADVANCE_EM = 1

// Accetta i livelli e i vecchi valori numerici in px (24 / 28 / 32), anche come stringa
export const normalizeSizeLevel = (size: unknown): DiagramSizeLevel => {
  if (size === 'small' || size === 'medium' || size === 'large') return size
  const n = Number(size)
  if (Number.isFinite(n) && n > 0) return n <= 24 ? 'small' : n >= 32 ? 'large' : 'medium'
  return 'medium'
}

// La scacchiera è larga 10 caratteri: 8 case più i due bordi
const BOARD_CHARS = 10
// Larghezza del badge a sinistra della scacchiera, per lato di casa: ~0.6em a carattere, con font a 0.8 del lato
const BADGE_EM_PER_CHAR = 0.8 * 0.6
const BADGE_CHARS_WORST_CASE = 5   // "12.34"
const BADGE_FIXED_PX = 12 + 10     // padding del badge + distanza dalla scacchiera
// Nel PDF il padding del badge è 14 px invece di 12: la misura massima tiene conto del caso più largo
const BADGE_FIXED_PDF_PX = 14 + 10

// In colonna i livelli sono frazioni della misura massima che ci sta
const COLUMN_LEVEL_FACTOR: Record<DiagramSizeLevel, number> = { small: 0.8, medium: 0.9, large: 1 }

/** Spazio (px) a sinistra della scacchiera per badge e pallino, che sono position:absolute */
export const badgeReservePx = (sizePx: number, label: string): number => {
  const chars = Math.max(label.length, 4)
  return Math.ceil(sizePx * BADGE_EM_PER_CHAR * chars + BADGE_FIXED_PX)
}

/** Lato di casa massimo (px) con cui badge e scacchiera stanno in una colonna */
const columnFitPx = (columnWidthMm: number): number =>
  (columnWidthMm * MM_TO_PX - BADGE_FIXED_PDF_PX) / (BOARD_CHARS + BADGE_EM_PER_CHAR * BADGE_CHARS_WORST_CASE)

// Dimensione del font (px) che dà la scacchiera della misura voluta.
// Con columnWidthMm la misura si adatta alla colonna, senza mai superare quella del formato.
export const diagramFontPx = (level: DiagramSizeLevel, pageFormat?: string, columnWidthMm?: number): number => {
  const table = PLAYING_AREA_MM[pageFormat || 'a4'] ?? PLAYING_AREA_MM.a4
  const squarePx = (table[level] / 8) * MM_TO_PX
  const fitted = columnWidthMm === undefined
    ? squarePx
    : Math.min(squarePx, columnFitPx(columnWidthMm) * COLUMN_LEVEL_FACTOR[level])
  return Math.round((fitted / MERIDA_ADVANCE_EM) * 100) / 100
}