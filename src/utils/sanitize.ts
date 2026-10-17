import DOMPurify from 'dompurify'
import { Chess } from 'chess.js'
import type { ChessMoveNode, ChessTree } from '../stores/chessTreeStore'
import type { SectionIndexItem } from '../stores/chessBookStore'
import { STANDARD_FEN, isLegalFen, normalizeFen } from './fen'

const SAFE_ID = /^[\w.-]{1,80}$/
const SAN_RE = /^[KQRBNOa-h1-8x=+#-]{2,9}$/
const MAX_TREES = 500
const MAX_NODES = 50000
const MAX_DEPTH = 2000

// ---------------------------------------------------------------------------
// Commenti delle mosse: solo formattazione minima, nessun attributo
// ---------------------------------------------------------------------------
const COMMENT_CONFIG = {
  ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'sub', 'sup', 'br'],
  ALLOWED_ATTR: [] as string[],
}

export const sanitizeCommentHtml = (html: unknown): string =>
  typeof html === 'string' && html ? DOMPurify.sanitize(html, COMMENT_CONFIG) : ''

// ---------------------------------------------------------------------------
// FEN: controllo strutturale (la legalità la verifica chess.js al caricamento)
// ---------------------------------------------------------------------------
export function isValidFen(fen: unknown): fen is string {
  if (typeof fen !== 'string' || fen.length > 100) return false
  const parts = fen.trim().split(/\s+/)
  if (parts.length < 2 || parts.length > 6) return false

  const ranks = parts[0].split('/')
  if (ranks.length !== 8) return false
  for (const rank of ranks) {
    let files = 0
    for (const ch of rank) {
      if (/[1-8]/.test(ch)) files += Number(ch)
      else if (/[pnbrqkPNBRQK]/.test(ch)) files++
      else return false
    }
    if (files !== 8) return false
  }

  if (parts[1] !== 'w' && parts[1] !== 'b') return false
  if (parts[2] !== undefined && !/^(-|[KQkq]{1,4})$/.test(parts[2])) return false
  if (parts[3] !== undefined && !/^(-|[a-h][36])$/.test(parts[3])) return false
  if (parts[4] !== undefined && !/^\d{1,4}$/.test(parts[4])) return false
  if (parts[5] !== undefined && !/^\d{1,4}$/.test(parts[5])) return false
  return true
}

// ---------------------------------------------------------------------------
// Alberi di mosse (da .mtcbook o IndexedDB): si ricostruiscono campo per campo
// ---------------------------------------------------------------------------
interface Ctx { count: number; ids: Set<string>; dropped: number }

const randomId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

// Rigioca la mossa dalla posizione del padre: colore, numero e FEN si ricavano da lì, mai dal file
function replayMove(parentFen: string, san: string) {
  try {
    const chess = new Chess(parentFen)
    const color = chess.turn()
    const moveNumber = chess.moveNumber()
    const played = chess.move(san)
    return { color, moveNumber, san: played.san, fen: chess.fen() }
  } catch {
    return null
  }
}

function cleanNode(raw: any, parentId: string | null, parentFen: string, ctx: Ctx, depth: number): ChessMoveNode | null {
  if (!raw || typeof raw !== 'object') return null
  if (depth > MAX_DEPTH || ctx.count >= MAX_NODES) return null
  if (typeof raw.san !== 'string' || !SAN_RE.test(raw.san)) { ctx.dropped++; return null }

  // Una mossa illegale dalla posizione del padre (albero corrotto) scarta il suo sottoalbero
  const played = replayMove(parentFen, raw.san)
  if (!played) { ctx.dropped++; return null }

  let id = typeof raw.id === 'string' && SAFE_ID.test(raw.id) ? raw.id : randomId('move')
  if (ctx.ids.has(id)) id = randomId('move')
  ctx.ids.add(id)
  ctx.count++

  const nags = Array.isArray(raw.nags)
    ? raw.nags.filter((n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 255)
    : []

  const node: ChessMoveNode = {
    id,
    san: played.san,
    fen: played.fen,
    moveNumber: played.moveNumber,
    color: played.color,
    parentId,
    comment: sanitizeCommentHtml(raw.comment) || null,
    children: []
  }
  if (nags.length) node.nags = nags

  if (Array.isArray(raw.children)) {
    node.children = raw.children
      .map((c: unknown) => cleanNode(c, id, played.fen, ctx, depth + 1))
      .filter((c: ChessMoveNode | null): c is ChessMoveNode => c !== null)
  }
  return node
}

// Tag PGN dell'albero: solo coppie di stringhe con chiave semplice, lunghezze limitate
const MAX_HEADER_TAGS = 50
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function cleanHeader(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, string> = {}
  let count = 0
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_HEADER_TAGS) break
    if (!/^[A-Za-z0-9_]{1,40}$/.test(key) || FORBIDDEN_KEYS.has(key) || typeof value !== 'string') continue
    out[key] = value.slice(0, 500)
    count++
  }
  return count ? out : undefined
}

export function sanitizeTrees(raw: unknown): ChessTree[] {
  if (!Array.isArray(raw)) return []
  const seenTrees = new Set<string>()
  const out: ChessTree[] = []

  for (const t of raw.slice(0, MAX_TREES)) {
    if (!t || typeof t !== 'object') continue
    if (typeof t.id !== 'string' || !SAFE_ID.test(t.id) || seenTrees.has(t.id)) continue
    seenTrees.add(t.id)

    const startingFen = typeof t.startingFen === 'string' && isValidFen(t.startingFen) && isLegalFen(t.startingFen)
      ? normalizeFen(t.startingFen)
      : STANDARD_FEN

    const ctx: Ctx = { count: 0, ids: new Set(), dropped: 0 }
    const rootNodes = (Array.isArray(t.rootNodes) ? t.rootNodes : [])
      .map((n: unknown) => cleanNode(n, null, startingFen, ctx, 0))
      .filter((n: ChessMoveNode | null): n is ChessMoveNode => n !== null)

    const safeOptId = (v: unknown) => (typeof v === 'string' && SAFE_ID.test(v) ? v : null)

    if (ctx.dropped > 0) {
      console.warn(`[sanitizeTrees] Albero «${t.id}»: scartati ${ctx.dropped} rami con mosse non legali dalla posizione del padre.`)
    }

    const header = cleanHeader(t.header)

    out.push({
      id: t.id,
      title: (typeof t.title === 'string' ? t.title : '').slice(0, 200) || 'Albero',
      startingFen,
      ...(header ? { header } : {}),
      rootNodes,
      activeNodeId: ctx.ids.has(t.activeNodeId) ? t.activeNodeId : null,
      parentTreeId: safeOptId(t.parentTreeId),
      splitAtNodeId: safeOptId(t.splitAtNodeId)
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Indice delle sezioni: gli id finiscono in attributi HTML (export server)
// ---------------------------------------------------------------------------
export function sanitizeSectionIndex(raw: unknown): SectionIndexItem[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: SectionIndexItem[] = []

  for (const item of raw.slice(0, 1000)) {
    if (!item || typeof item !== 'object') continue
    const { id, type, title } = item as Record<string, unknown>
    if (typeof id !== 'string' || !SAFE_ID.test(id) || seen.has(id)) continue
    if (type !== 'cover' && type !== 'index' && type !== 'chapter') continue
    seen.add(id)
    out.push({ id, type, title: (typeof title === 'string' ? title : '').slice(0, 200) || 'Senza titolo' })
  }
  return out
}