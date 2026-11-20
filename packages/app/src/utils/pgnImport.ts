import { Chess } from 'chess.js'
import { parsePgn, parseComment } from 'chessops/pgn'
import { makeSquare } from 'chessops/util'
import type { Game, PgnNodeData, ChildNode } from 'chessops/pgn'
import type { ChessMoveNode, ChessTree } from '../stores/chessTreeStore'
import { STANDARD_FEN } from './fen'
import { newId } from './ids'
import { escapeHtml } from './html'
import { countNodes } from './treeOps'
import { shouldShowHeaderByDefault } from './pgnHeader'
import { cleanShapes, normalizeBrush, type BoardShape } from './shapes'

export { normalizeFen, samePosition } from './fen'

const MAX_NODES = 20000
const MAX_DEPTH = 2000
const MAX_WARNINGS = 50
const MAX_TEXT_LENGTH = 5 * 1024 * 1024

export interface PgnGameInfo {
  index: number
  title: string
  result: string
  startFen: string
  header: Record<string, string>   // tag PGN della partita
  problem?: string           // se presente, la partita non è importabile
  game: Game<PgnNodeData>
}

export interface ImportStats {
  moves: number
  variations: number
  comments: number
  nags: number
  diagrams: number           // diagrammi indicati nel PGN (vedi DIAGRAM_MARK)
  warnings: string[]
}

/**
 * Dove il PGN chiede un diagramma: dopo le mosse indicate e/o sulla posizione iniziale.
 * Marcatori riconosciuti: `[#]` in un commento (ChessBase) e il simbolo 201 «Diagramma» (Scid).
 * Commento dopo la mossa = diagramma dopo la mossa; commento prima della mossa = diagramma sulla posizione precedente.
 */
export interface PgnDiagramMarks {
  atStart: boolean
  afterNodeIds: string[]
}

export const nodeLabel = (n: ChessMoveNode) =>
  `${n.moveNumber}${n.color === 'w' ? '.' : '...'} ${n.san}`


// ---------------------------------------------------------------------------
// Lettura del testo PGN
// ---------------------------------------------------------------------------
function toInfo(game: Game<PgnNodeData>, index: number): PgnGameInfo {
  const header = (key: string) => (game.headers.get(key) ?? '').trim()
  const clean = (v: string) => (v === '?' || v === '*' ? '' : v)

  const white = clean(header('White'))
  const black = clean(header('Black'))
  const event = clean(header('Event'))
  const players = white || black ? `${white || '?'} – ${black || '?'}` : ''
  const title = [players, event].filter(Boolean).join(', ') || `Albero ${index + 1}`

  let problem: string | undefined
  const variant = header('Variant').toLowerCase()
  if (variant && !['standard', 'chess', 'from position'].includes(variant)) {
    problem = `La variante «${header('Variant')}» non è supportata.`
  }

  let startFen = STANDARD_FEN
  const fenHeader = header('FEN')
  if (fenHeader) {
    try {
      startFen = new Chess(fenHeader).fen()
    } catch {
      problem = problem ?? 'La posizione iniziale (FEN) del PGN non è valida.'
    }
  }

  const tags: Record<string, string> = {}
  for (const [k, v] of game.headers) {
    if (v.trim() !== '') tags[k] = v.slice(0, 500)
  }

  return { index, title, result: clean(header('Result')), startFen, header: tags, problem, game }
}

export function parsePgnText(text: string): { games: PgnGameInfo[]; empty?: number; error?: string } {
  if (text.length > MAX_TEXT_LENGTH) {
    return { games: [], error: 'Il testo è troppo grande (massimo 5 MB).' }
  }

  let games: Game<PgnNodeData>[]
  try {
    games = parsePgn(text)
  } catch {
    return { games: [], error: 'Il testo non è un PGN leggibile.' }
  }

  const infos: PgnGameInfo[] = []
  let empty = 0
  for (const game of games) {
    if (game.moves.children.length === 0) { empty++; continue }   // partite senza mosse: contate, non importate
    infos.push(toInfo(game, infos.length))
  }
  if (infos.length === 0) return { games: [], error: 'Nessuna mossa trovata nel testo.' }
  return { games: infos, empty }
}

// ---------------------------------------------------------------------------
// Conversione in albero dell'app
// ---------------------------------------------------------------------------
interface Ctx { stats: ImportStats; count: number; marks: PgnDiagramMarks }

const newStats = (): ImportStats => ({ moves: 0, variations: 0, comments: 0, nags: 0, diagrams: 0, warnings: [] })
const newCtx = (): Ctx => ({ stats: newStats(), count: 0, marks: { atStart: false, afterNodeIds: [] } })

// Esattamente «[#]»: un # da solo (scacco matto in un commento) non è un diagramma
const DIAGRAM_MARK = /\[#\]/
const DIAGRAM_MARK_ALL = /\s*\[#\]\s*/g
const DIAGRAM_NAG = 201
const hasDiagramMark = (strings?: string[]) => (strings ?? []).some(c => DIAGRAM_MARK.test(c))

const warn = (ctx: Ctx, message: string) => {
  const list = ctx.stats.warnings
  if (list.length < MAX_WARNINGS && !list.includes(message)) list.push(message)
}

const joinHtml = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' ')

// I commenti dell'app sono HTML: il testo del PGN va sempre escapato.
// I comandi dei programmi ([%clk ...], [%eval ...], frecce) vengono tolti da parseComment.
const commentsToHtml = (strings?: string[]): string =>
  (strings ?? [])
    .map(c => parseComment(c).text.replace(DIAGRAM_MARK_ALL, ' ').trim())
    .filter(Boolean)
    .map(t => escapeHtml(t).replace(/\s*\n\s*/g, ' '))
    .join(' ')

// Frecce e cerchi dei commenti ([%cal Ge2e4] / [%csl Rd5]): i colori si riducono ai due dell'app
const commentsToShapes = (strings?: string[]): BoardShape[] =>
  (strings ?? []).flatMap(c =>
    parseComment(c).shapes.map(s => ({
      orig: makeSquare(s.from),
      ...(s.from !== s.to ? { dest: makeSquare(s.to) } : {}),
      brush: normalizeBrush(s.color)
    }))
  )

function buildNodes(
  parentFen: string,
  parentId: string | null,
  pgnChildren: ChildNode<PgnNodeData>[],
  ctx: Ctx,
  depth: number,
  where: string
): ChessMoveNode[] {
  const nodes: ChessMoveNode[] = []

  pgnChildren.forEach((child, i) => {
    if (depth > MAX_DEPTH || ctx.count >= MAX_NODES) {
      warn(ctx, 'Il PGN supera i limiti di dimensione: la parte restante è stata ignorata.')
      return
    }

    const chess = new Chess(parentFen)
    const color = chess.turn()
    const moveNumber = Number(parentFen.split(' ')[5]) || 1

    let played: ReturnType<Chess['move']> | null = null
    try {
      played = chess.move(child.data.san)
    } catch {
      played = null
    }
    if (!played) {
      warn(ctx, `Mossa non valida «${child.data.san}» dopo ${where}: ${i === 0 ? 'la prosecuzione' : 'la variante'} è stata ignorata.`)
      return
    }

    ctx.count++
    const comment = joinHtml(
      commentsToHtml(child.data.startingComments),
      commentsToHtml(child.data.comments)
    )
    const rawNags = (child.data.nags ?? []).filter(n => Number.isInteger(n))
    const nags = rawNags.filter(n => n !== DIAGRAM_NAG)   // il diagramma non è un simbolo da stampare
    const shapes = cleanShapes([
      ...commentsToShapes(child.data.startingComments),
      ...commentsToShapes(child.data.comments)
    ])

    const node: ChessMoveNode = {
      id: newId('move'),
      san: played.san,
      fen: chess.fen(),
      moveNumber,
      color,
      parentId,
      comment: comment || null,
      children: []
    }
    if (nags.length) node.nags = nags
    if (shapes.length) node.shapes = shapes

    ctx.stats.moves++
    if (i > 0) ctx.stats.variations++
    if (comment) ctx.stats.comments++
    ctx.stats.nags += nags.length

    // Diagrammi chiesti dal PGN: commento prima della mossa → posizione precedente; dopo → posizione dopo la mossa
    if (hasDiagramMark(child.data.startingComments)) {
      if (!parentId) ctx.marks.atStart = true
      else if (!ctx.marks.afterNodeIds.includes(parentId)) ctx.marks.afterNodeIds.push(parentId)
    }
    if (hasDiagramMark(child.data.comments) || rawNags.includes(DIAGRAM_NAG)) ctx.marks.afterNodeIds.push(node.id)

    node.children = buildNodes(
      node.fen, node.id, child.children, ctx, depth + 1,
      `${moveNumber}${color === 'w' ? '.' : '...'}${played.san}`
    )
    nodes.push(node)
  })

  return nodes
}

// Il commento generale della partita finisce nel commento della prima mossa
function attachGameComment(nodes: ChessMoveNode[], info: PgnGameInfo, stats: ImportStats) {
  const intro = commentsToHtml(info.game.comments)
  if (intro && nodes[0]) {
    nodes[0].comment = joinHtml(intro, nodes[0].comment)
    stats.comments++
  }
}

/** Nuovo albero completo, a partire dalla posizione iniziale del PGN */
export function buildTreeFromGame(info: PgnGameInfo): { tree: ChessTree; stats: ImportStats; marks: PgnDiagramMarks } {
  const ctx = newCtx()
  const rootNodes = buildNodes(info.startFen, null, info.game.moves.children, ctx, 0, 'la posizione iniziale')
  attachGameComment(rootNodes, info, ctx.stats)
  if (hasDiagramMark(info.game.comments)) ctx.marks.atStart = true
  ctx.stats.diagrams = ctx.marks.afterNodeIds.length + (ctx.marks.atStart ? 1 : 0)

  const tree: ChessTree = {
    id: newId('tree'),
    title: info.title,
    startingFen: info.startFen,
    rootNodes,
    activeNodeId: null,
    ...(Object.keys(info.header).length
      ? { header: info.header, showHeader: shouldShowHeaderByDefault(info.header) }
      : {})
  }
  return { tree, stats: ctx.stats, marks: ctx.marks }
}

/** Solo i rami, da agganciare sotto un nodo esistente (la numerazione parte dalla sua FEN) */
export function buildBranch(
  startFen: string,
  parentId: string | null,
  info: PgnGameInfo
): { nodes: ChessMoveNode[]; stats: ImportStats } {
  const ctx = newCtx()   // aggancio a un albero esistente: i marcatori di diagramma si tolgono e basta
  const nodes = buildNodes(startFen, parentId, info.game.moves.children, ctx, 0, 'la posizione di aggancio')
  attachGameComment(nodes, info, ctx.stats)
  return { nodes, stats: ctx.stats }
}

// ---------------------------------------------------------------------------
// Unione con un albero esistente
// ---------------------------------------------------------------------------
/** Unisce i rami importati a quelli esistenti (stessa mossa = stesso nodo). Restituisce i nodi aggiunti. */
export function mergeNodes(target: ChessMoveNode[], incoming: ChessMoveNode[]): number {
  let added = 0
  for (const inc of incoming) {
    const existing = target.find(n => n.san === inc.san)
    if (!existing) {
      target.push(inc)
      added += countNodes([inc])
      continue
    }
    if (!existing.comment && inc.comment) existing.comment = inc.comment
    if (!existing.shapes && inc.shapes) existing.shapes = inc.shapes
    if (inc.nags?.length) existing.nags = [...new Set([...(existing.nags ?? []), ...inc.nags])]
    inc.children.forEach(c => { c.parentId = existing.id })
    added += mergeNodes(existing.children, inc.children)
  }
  return added
}