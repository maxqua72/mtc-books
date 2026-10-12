import { MM_TO_PX } from './cover'

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

// Dimensione del font (px) che dà la scacchiera della misura voluta
export const diagramFontPx = (level: DiagramSizeLevel, pageFormat?: string): number => {
  const table = PLAYING_AREA_MM[pageFormat || 'a4'] ?? PLAYING_AREA_MM.a4
  const squareMm = table[level] / 8
  return Math.round(((squareMm * MM_TO_PX) / MERIDA_ADVANCE_EM) * 100) / 100
}