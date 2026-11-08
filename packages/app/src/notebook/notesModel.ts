// Appunti del Taccuino: modello e conversioni pure (niente DOM, niente store), testabili in Node.
// Un appunto ha lo stesso contenuto di un capitolo del libro: HTML dell'editor + alberi di mosse.
import { Chess } from 'chess.js'
import type { ChessMoveNode, ChessTree } from '../stores/chessTreeStore'
import type { BookPackage } from '../stores/book/mtcbookIO'
import { defaultMetadata, type SectionIndexItem } from '../stores/book/types'
import { escapeHtml, extractTreeIds } from '../utils/html'
import { normalizeFen } from '../utils/fen'
import { cloneTree, findNode } from '../utils/treeOps'
import { newId, randomToken } from '../utils/ids'

/** Libro in cui un appunto è già stato inserito (solo informativo) */
export interface NoteInsertion { bookId: string; title: string; at: string }

export interface Note {
  id: string
  title: string
  html: string          // corpo, senza titolo
  trees: ChessTree[]
  createdAt: string
  updatedAt: string
  insertedIn?: NoteInsertion[]
}

export const UNTITLED_NOTE = 'Appunto senza titolo'
export const NOTES_BOOK_TITLE = 'Appunti dal Taccuino'

export function createNote(now = new Date().toISOString()): Note {
  return { id: `note-${randomToken()}`, title: '', html: '', trees: [], createdAt: now, updatedAt: now }
}

export const noteTitle = (note: Pick<Note, 'title'>): string => note.title.trim() || UNTITLED_NOTE

// ---------------------------------------------------------------------------
// Linea di mosse (scheda «Mosse» del pannello Scacchiera)
// ---------------------------------------------------------------------------

/** Albero con una sola linea. Si ferma alla prima mossa illegale. */
export function buildLineTree(startFen: string, sans: string[], title = 'Linea'): ChessTree {
  const start = normalizeFen(startFen)
  const chess = new Chess(start)
  const rootNodes: ChessMoveNode[] = []
  let parent: ChessMoveNode | null = null
  for (const san of sans) {
    const color = chess.turn()
    const moveNumber = chess.moveNumber()
    let played: ReturnType<Chess['move']>
    try { played = chess.move(san) } catch { break }
    const node: ChessMoveNode = {
      id: newId('move'), san: played.san, fen: chess.fen(), moveNumber, color,
      parentId: parent ? parent.id : null, comment: null, children: [],
    }
    ;(parent ? parent.children : rootNodes).push(node)
    parent = node
  }
  return { id: newId('tree'), title, startingFen: start, rootNodes, activeNodeId: null }
}

/** Albero di una linea con eventuali varianti, a partire dai nodi giocati */
export const makeLineTree = (startFen: string, rootNodes: ChessMoveNode[], title = 'Linea'): ChessTree =>
  ({ id: newId('tree'), title, startingFen: normalizeFen(startFen), rootNodes, activeNodeId: null })

/**
 * Gioca `san` dopo il nodo `parentId` (null = posizione di partenza). Se la mossa c'è già
 * la riusa; altrimenti la aggiunge come seguito o, se il seguito esiste, come variante.
 * Restituisce il nodo, o null se la mossa è illegale.
 */
export function addMove(rootNodes: ChessMoveNode[], startFen: string, parentId: string | null, san: string): ChessMoveNode | null {
  const parent = parentId ? findNode(rootNodes, parentId) : null
  if (parentId && !parent) return null
  const siblings = parent ? parent.children : rootNodes
  const chess = new Chess(parent ? parent.fen : normalizeFen(startFen))
  const color = chess.turn()
  const moveNumber = chess.moveNumber()
  let played: ReturnType<Chess['move']>
  try { played = chess.move(san) } catch { return null }
  const existing = siblings.find(n => n.san === played.san)
  if (existing) return existing
  const node: ChessMoveNode = {
    id: newId('move'), san: played.san, fen: chess.fen(), moveNumber, color,
    parentId: parent ? parent.id : null, comment: null, children: [],
  }
  siblings.push(node)
  return node
}

/** Toglie il nodo con il suo seguito. Restituisce l'id del nodo precedente (null = partenza). */
export function removeMove(rootNodes: ChessMoveNode[], id: string): string | null {
  const node = findNode(rootNodes, id)
  if (!node) return null
  const parent = node.parentId ? findNode(rootNodes, node.parentId) : null
  const siblings = parent ? parent.children : rootNodes
  const i = siblings.findIndex(n => n.id === id)
  if (i >= 0) siblings.splice(i, 1)
  return node.parentId
}

/** Linea principale in SAN */
export function mainLineSans(tree: Pick<ChessTree, 'rootNodes'>): string[] {
  const out: string[] = []
  let nodes = tree.rootNodes
  while (nodes.length) { out.push(nodes[0].san); nodes = nodes[0].children }
  return out
}

/** Pezzo della linea stampata: una mossa (con numero se serve) o una parentesi di variante */
export type LineToken =
  | { kind: 'move'; id: string; text: string; depth: number }
  | { kind: 'open' | 'close'; depth: number }

/** Linea con le varianti fra parentesi, come in PGN: «1. e4 (1. d4 d5) 1... e5» */
export function lineTokens(rootNodes: ChessMoveNode[]): LineToken[] {
  const out: LineToken[] = []
  const walk = (nodes: ChessMoveNode[], depth: number) => {
    let needNumber = true
    while (nodes.length) {
      const n = nodes[0]
      const prefix = n.color === 'w' ? `${n.moveNumber}. ` : needNumber ? `${n.moveNumber}... ` : ''
      out.push({ kind: 'move', id: n.id, text: prefix + n.san, depth })
      needNumber = false
      for (const v of nodes.slice(1)) {
        out.push({ kind: 'open', depth: depth + 1 })
        walk([v], depth + 1)
        out.push({ kind: 'close', depth: depth + 1 })
        needNumber = true
      }
      nodes = n.children
    }
  }
  walk(rootNodes, 0)
  return out
}

/** «1. e4 e5 2. Nf3», «12... Nf6 13. Bg5» se tocca al Nero, con le varianti fra parentesi */
export function formatLine(tree: Pick<ChessTree, 'rootNodes'>): string {
  let text = ''
  let prev: LineToken['kind'] | null = null
  for (const t of lineTokens(tree.rootNodes)) {
    const glue = prev === null || prev === 'open' || t.kind === 'close' ? '' : ' '
    text += glue + (t.kind === 'move' ? t.text : t.kind === 'open' ? '(' : ')')
    prev = t.kind
  }
  return text
}

// ---------------------------------------------------------------------------
// Elenco degli appunti
// ---------------------------------------------------------------------------

const DIAGRAM_RE = /data-type="chess-diagram"/g

export function noteStats(note: Pick<Note, 'html'>): { diagrams: number; lines: number } {
  return {
    diagrams: (note.html.match(DIAGRAM_RE) ?? []).length,
    lines: extractTreeIds(note.html).length,
  }
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

/** Prime parole del testo, senza scacchiere né tag */
export function notePreview(note: Pick<Note, 'html'>, max = 120): string {
  const text = note.html
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')         // scacchiera testuale dei diagrammi
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text
}

// ---------------------------------------------------------------------------
// Appunti <-> .mtcbook: ogni appunto è un capitolo, con il titolo come Titolo 1
// ---------------------------------------------------------------------------

const LEADING_H2 = /^\s*<h2\b[^>]*>[\s\S]*?<\/h2>/

export const stripLeadingHeading = (html: string): string => html.replace(LEADING_H2, '')

/** HTML del capitolo: titolo + corpo */
export const chapterHtml = (note: Pick<Note, 'title' | 'html'>): string =>
  `<h2>${escapeHtml(noteTitle(note))}</h2>${note.html}`

export function notesToPackage(notes: Note[], now = new Date().toISOString()): BookPackage {
  const metadata = { ...defaultMetadata(), title: NOTES_BOOK_TITLE, author: '', createdAt: now, updatedAt: now }
  const sectionIndex: SectionIndexItem[] = notes.map(n => ({ id: n.id, type: 'chapter', title: noteTitle(n) }))
  const sections: Record<string, string> = {}
  for (const n of notes) sections[n.id] = JSON.stringify({ id: n.id, html: chapterHtml(n), trees: n.trees })
  return { metadata, sectionIndex, sections, assets: [] }
}

/** Capitoli e sezioni di testo diventano appunti. `cleanTrees` ripulisce gli alberi letti dal file. */
export function packageToNotes(
  pkg: BookPackage,
  cleanTrees: (raw: unknown) => ChessTree[] = (raw) => (Array.isArray(raw) ? raw as ChessTree[] : []),
  now = new Date().toISOString(),
): Note[] {
  const out: Note[] = []
  for (const item of pkg.sectionIndex) {
    if (item.type !== 'chapter' && item.type !== 'text') continue
    let parsed: { html?: unknown; trees?: unknown } = {}
    try { parsed = JSON.parse(pkg.sections[item.id] ?? '{}') } catch { continue }
    const html = typeof parsed.html === 'string' ? stripLeadingHeading(parsed.html) : ''
    const title = item.title === UNTITLED_NOTE ? '' : item.title
    out.push({ id: item.id, title, html, trees: cleanTrees(parsed.trees), createdAt: now, updatedAt: now })
  }
  return out
}

/**
 * Unisce gli appunti importati all'archivio. Stesso id = stesso appunto: il contenuto
 * si aggiorna, date di creazione e libri di inserimento restano.
 */
export function mergeImportedNotes(existing: Note[], incoming: Note[]): { notes: Note[]; added: number; updated: number } {
  const byId = new Map(existing.map(n => [n.id, n]))
  const notes: Note[] = []
  let added = 0
  let updated = 0
  for (const n of incoming) {
    const old = byId.get(n.id)
    if (!old) { added++; notes.push(n); continue }
    updated++
    notes.push({ ...n, createdAt: old.createdAt, ...(old.insertedIn ? { insertedIn: old.insertedIn } : {}) })
  }
  return { notes, added, updated }
}

// ---------------------------------------------------------------------------
// Inserimento nel libro
// ---------------------------------------------------------------------------

/** Tag di apertura dei diagrammi: l'id si toglie, l'editor del libro ne assegna uno nuovo */
const DIAGRAM_TAG_RE = /<div\b[^>]*data-type="chess-diagram"[^>]*>/g

/**
 * Contenuto pronto per il libro: alberi con id nuovi (lo stesso appunto può finire in più libri
 * o due volte nello stesso), diagrammi senza id. Gli alberi non usati dal testo si scartano.
 */
export function prepareNoteForBook(note: Pick<Note, 'html' | 'trees'>): { html: string; trees: ChessTree[] } {
  const used = new Set(extractTreeIds(note.html))
  const idMap = new Map<string, string>()
  const trees: ChessTree[] = []
  for (const t of note.trees) {
    if (!used.has(t.id) || idMap.has(t.id)) continue
    const copy = cloneTree(t, t.title)
    idMap.set(t.id, copy.id)
    trees.push(copy)
  }
  const html = note.html
    .replace(/\b((?:data-)?tree-id)="([^"]*)"/g, (m, attr: string, id: string) =>
      idMap.has(id) ? `${attr}="${idMap.get(id)}"` : m)
    .replace(DIAGRAM_TAG_RE, (tag) => tag.replace(/\sdata-id="[^"]*"/, ''))
  return { html, trees }
}

/** Nome del file condiviso: appunti-AAAA-MM-GG.mtcbook */
export const notesFileName = (date = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `appunti-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.mtcbook`
}

/** Evento della vista di un nodo toccato: il Taccuino apre la scacchiera su quel contenuto */
export const EDIT_NODE_EVENT = 'note-edit-node'
