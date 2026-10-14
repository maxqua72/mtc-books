import DOMPurify from 'dompurify'
import type { ChessMoveNode, ChessTree } from '../stores/chessTreeStore'
import type { SectionIndexItem } from '../stores/chessBookStore'

const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
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
interface Ctx { count: number; ids: Set<string> }

const randomId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

function cleanNode(raw: any, parentId: string | null, ctx: Ctx, depth: number): ChessMoveNode | null {
  if (!raw || typeof raw !== 'object') return null
  if (depth > MAX_DEPTH || ctx.count >= MAX_NODES) return null
  if (typeof raw.san !== 'string' || !SAN_RE.test(raw.san)) return null
  if (!isValidFen(raw.fen)) return null

  let id = typeof raw.id === 'string' && SAFE_ID.test(raw.id) ? raw.id : randomId('move')
  if (ctx.ids.has(id)) id = randomId('move')
  ctx.ids.add(id)
  ctx.count++

  const moveNumber = Number.isInteger(raw.moveNumber) && raw.moveNumber >= 1 && raw.moveNumber <= 1000
    ? raw.moveNumber : 1
  const nags = Array.isArray(raw.nags)
    ? raw.nags.filter((n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 255)
    : []

  const node: ChessMoveNode = {
    id,
    san: raw.san,
    fen: raw.fen,
    moveNumber,
    color: raw.color === 'b' ? 'b' : 'w',
    parentId,
    comment: sanitizeCommentHtml(raw.comment) || null,
    children: []
  }
  if (nags.length) node.nags = nags

  if (Array.isArray(raw.children)) {
    node.children = raw.children
      .map((c: unknown) => cleanNode(c, id, ctx, depth + 1))
      .filter((c: ChessMoveNode | null): c is ChessMoveNode => c !== null)
  }
  return node
}

export function sanitizeTrees(raw: unknown): ChessTree[] {
  if (!Array.isArray(raw)) return []
  const seenTrees = new Set<string>()
  const out: ChessTree[] = []

  for (const t of raw.slice(0, MAX_TREES)) {
    if (!t || typeof t !== 'object') continue
    if (typeof t.id !== 'string' || !SAFE_ID.test(t.id) || seenTrees.has(t.id)) continue
    seenTrees.add(t.id)

    const ctx: Ctx = { count: 0, ids: new Set() }
    const rootNodes = (Array.isArray(t.rootNodes) ? t.rootNodes : [])
      .map((n: unknown) => cleanNode(n, null, ctx, 0))
      .filter((n: ChessMoveNode | null): n is ChessMoveNode => n !== null)

    const safeOptId = (v: unknown) => (typeof v === 'string' && SAFE_ID.test(v) ? v : null)

    out.push({
      id: t.id,
      title: (typeof t.title === 'string' ? t.title : '').slice(0, 200) || 'Analisi',
      startingFen: isValidFen(t.startingFen) ? t.startingFen : STANDARD_FEN,
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