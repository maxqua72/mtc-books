import { Chess } from 'chess.js'
import type { AnalysisScore } from '@mtc/shared'

export interface PvResult {
  text: string        // "1. e4 e5 2. Nf3"
  sans: string[]      // solo le mosse in SAN
  complete: boolean   // false se la linea è stata interrotta (mossa illegale) o accorciata
}

/** Converte una linea UCI in SAN a partire dalla posizione analizzata. Una mossa illegale interrompe la conversione. */
export function pvToSan(fen: string, pv: string[], maxMoves = 24): PvResult {
  let chess: Chess
  try { chess = new Chess(fen) } catch { return { text: '', sans: [], complete: false } }

  const parts: string[] = []
  const sans: string[] = []
  let complete = true
  for (const [i, uci] of pv.slice(0, maxMoves).entries()) {
    const number = chess.moveNumber()
    const turn = chess.turn()
    let san: string
    try {
      san = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined }).san
    } catch {
      complete = false
      break
    }
    sans.push(san)
    parts.push(turn === 'w' ? `${number}. ${san}` : i === 0 ? `${number}... ${san}` : san)
  }
  if (pv.length > maxMoves) complete = false
  return { text: parts.join(' '), sans, complete }
}

export const uciToSan = (fen: string, uci: string): string | null => pvToSan(fen, [uci], 1).sans[0] ?? null

/** +0.35, -1.20, #3, #-2 (sempre dal punto di vista del Bianco) */
export function formatScore(score: AnalysisScore | null): string {
  if (!score) return '…'
  if (score.kind === 'mate') return `#${score.value}`
  const pawns = score.value / 100
  return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2)
}