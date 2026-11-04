import { Chess } from 'chess.js'
import type { Color, Role } from 'chessground/types'
import { STANDARD_FEN } from './fen'

export const EMPTY_PLACEMENT = '8/8/8/8/8/8/8/8'
export const STANDARD_PLACEMENT = STANDARD_FEN.split(' ')[0]

/** Strumento dell'editor: pezzo da posare, cestino, oppure null per spostare i pezzi già sulla scacchiera */
export type EditorTool = { color: Color; role: Role } | 'trash' | null

export interface CastlingRights { K: boolean; Q: boolean; k: boolean; q: boolean }

/** Ciò che il FEN contiene oltre ai pezzi. L'en passant non si imposta: l'editor scrive sempre «-» */
export interface EditorOptions {
  turn: 'w' | 'b'
  castling: CastlingRights
  moveNumber: number
}

export function parseEditorOptions(fen: string): EditorOptions {
  const [, turn, rights = '-', , , move] = fen.trim().split(/\s+/)
  const moveNumber = Number(move)
  return {
    turn: turn === 'b' ? 'b' : 'w',
    castling: { K: rights.includes('K'), Q: rights.includes('Q'), k: rights.includes('k'), q: rights.includes('q') },
    moveNumber: Number.isInteger(moveNumber) && moveNumber >= 1 ? moveNumber : 1,
  }
}

/** Traverse dall'ottava alla prima, con «.» per le case vuote */
const expandRows = (placement: string): string[] =>
  placement.split('/').map((row) => row.replace(/\d/g, (n) => '.'.repeat(Number(n))))

const pieceAt = (rows: string[], file: number, rank: number) => rows[8 - rank]?.[file] ?? '.'

/** Arrocchi possibili: re e torre devono trovarsi sulle case di partenza */
export function availableCastling(placement: string): CastlingRights {
  const rows = expandRows(placement)
  const white = pieceAt(rows, 4, 1) === 'K'
  const black = pieceAt(rows, 4, 8) === 'k'
  return {
    K: white && pieceAt(rows, 7, 1) === 'R',
    Q: white && pieceAt(rows, 0, 1) === 'R',
    k: black && pieceAt(rows, 7, 8) === 'r',
    q: black && pieceAt(rows, 0, 8) === 'r',
  }
}

export function composeFen(placement: string, options: EditorOptions): string {
  const possible = availableCastling(placement)
  const rights = (['K', 'Q', 'k', 'q'] as const).filter((r) => options.castling[r] && possible[r]).join('')
  const moveNumber = Number.isInteger(options.moveNumber) && options.moveNumber >= 1 ? options.moveNumber : 1
  return `${placement} ${options.turn} ${rights || '-'} - 0 ${moveNumber}`
}

/** Motivo per cui la posizione non si può applicare (null = valida) */
export function positionError(fen: string): string | null {
  const [placement, turn] = fen.split(' ')
  const count = (piece: string) => placement.split(piece).length - 1

  if (count('K') === 0) return 'Manca il re bianco.'
  if (count('k') === 0) return 'Manca il re nero.'
  if (count('K') > 1) return 'C\'è più di un re bianco.'
  if (count('k') > 1) return 'C\'è più di un re nero.'

  const rows = placement.split('/')
  if (/[pP]/.test(rows[0] ?? '') || /[pP]/.test(rows[7] ?? '')) {
    return 'I pedoni non possono stare sulla prima o sull\'ottava traversa.'
  }

  try {
    new Chess(fen)
    // chess.js accetta anche il re sotto scacco di chi non ha il tratto: si prova a passare la mossa all'altro
    const other = turn === 'w' ? 'b' : 'w'
    if (new Chess(`${placement} ${other} - - 0 1`).isCheck()) {
      return `Il re ${other === 'w' ? 'bianco' : 'nero'} è sotto scacco ma il tratto è dell\'altro giocatore.`
    }
  } catch {
    return 'La posizione non è valida.'
  }
  return null
}
