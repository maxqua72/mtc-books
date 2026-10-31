import { Chess } from 'chess.js'

export const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** FEN normalizzato da chess.js (se non è valido lo restituisce com'è) */
export const normalizeFen = (fen: string): string => {
  try { return new Chess(fen).fen() } catch { return fen }
}

/** chess.js accetta il FEN come posizione legale? */
export const isLegalFen = (fen: string): boolean => {
  try { new Chess(fen); return true } catch { return false }
}

/** Stessa posizione (pezzi, turno, arrocchi, en passant), ignorando i contatori delle mosse */
export const samePosition = (a: string, b: string): boolean =>
  normalizeFen(a).split(' ').slice(0, 4).join(' ') === normalizeFen(b).split(' ').slice(0, 4).join(' ')
