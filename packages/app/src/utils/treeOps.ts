// Operazioni pure sugli alberi di mosse (prima dentro chessTreeStore.ts e pgnImport.ts)
import type { ChessMoveNode, ChessTree } from '../stores/chessTreeStore'
import { newId } from './ids'
import { samePosition } from './fen'
import { Chess } from 'chess.js'

/** Cerca un nodo per id (visita iterativa: nessun rischio di stack overflow su alberi profondi) */
export const findNode = (nodes: ChessMoveNode[] | undefined, id: string): ChessMoveNode | null => {
  const stack = [...(nodes ?? [])]
  while (stack.length) {
    const n = stack.pop()!
    if (n.id === id) return n
    if (n.children?.length) stack.push(...n.children)
  }
  return null
}

/** Numero totale di nodi (visita iterativa) */
export const countNodes = (nodes: ChessMoveNode[]): number => {
  let total = 0
  const stack = [...nodes]
  while (stack.length) {
    const n = stack.pop()!
    total++
    if (n.children?.length) stack.push(...n.children)
  }
  return total
}

// Copia profonda dei nodi con id nuovi (e parentId coerenti): due alberi non condividono mai nulla
export const cloneNodes = (nodes: ChessMoveNode[], parentId: string | null): ChessMoveNode[] =>
  nodes.map(n => {
    const id = newId('move')
    return {
      ...n,
      id,
      parentId,
      ...(n.nags ? { nags: [...n.nags] } : {}),
      ...(n.shapes ? { shapes: n.shapes.map(s => ({ ...s })) } : {}),
      children: cloneNodes(n.children, id),
    }
  })

export const cloneTree = (src: ChessTree, title: string): ChessTree => ({
  id: newId('tree'),
  title,
  startingFen: src.startingFen,
  rootNodes: cloneNodes(src.rootNodes, null),
  activeNodeId: null,
  ...(src.header ? { header: { ...src.header }, showHeader: src.showHeader === true } : {}),
  ...(src.depthStart ? { depthStart: src.depthStart } : {}),
  ...(src.closeParens ? { closeParens: src.closeParens } : {}),
})

export interface NodeLocation {
  node: ChessMoveNode
  parent: ChessMoveNode | null
  siblings: ChessMoveNode[]      // include il nodo; [0] = linea principale
  index: number
}

export const locateNode = (rootNodes: ChessMoveNode[], id: string): NodeLocation | null => {
  const node = findNode(rootNodes, id)
  if (!node) return null
  const parent = node.parentId ? findNode(rootNodes, node.parentId) : null
  const siblings = parent ? parent.children : rootNodes
  const index = siblings.indexOf(node)
  return index === -1 ? null : { node, parent, siblings, index }
}

/** Dal nodo verso la radice: la prima posizione (nodo compreso) che soddisfa `test` */
export const findLine = (
  rootNodes: ChessMoveNode[], id: string, test: (loc: NodeLocation) => boolean
): NodeLocation | null => {
  let loc = locateNode(rootNodes, id)
  while (loc) {
    if (test(loc)) return loc
    loc = loc.parent ? locateNode(rootNodes, loc.parent.id) : null
  }
  return null
}

/**
 * Nodi le cui prosecuzioni vanno staccate se si taglia dopo `nodeId`, nell'ordine di stampa.
 * Esempio: m1 (a1 a2 a3 (b3 b4 b5) a4 a5 a6) m2 m3, con T = a2  →  [a2, m1]
 *   - a2: le sue prosecuzioni (a3 (b3 ...) a4 a5 a6) ripartono dalla FEN di a2
 *   - m1: la linea madre (m2 m3 ...) riparte dalla FEN di m1
 * Vuoto = dopo T non c'è nulla da stampare: non si divide.
 */
export const splitPoints = (rootNodes: ChessMoveNode[], nodeId: string): ChessMoveNode[] => {
  const target = findNode(rootNodes, nodeId)
  if (!target) return []
  const points: ChessMoveNode[] = []
  if (target.children.length > 0) points.push(target)

  let current: ChessMoveNode = target
  for (;;) {
    // la variante che contiene `current`: la sua radice ha fratelli prima di sé
    const loc = findLine(rootNodes, current.id, l => l.index > 0)
    if (!loc) break
    const main = loc.siblings[0]
    if (main.children.length > 0) points.push(main)
    current = main
  }
  return points
}

/** Radici delle varianti che contengono il nodo, dalla più esterna alla più interna */
export const variationRootsOnPath = (rootNodes: ChessMoveNode[], id: string): string[] => {
  const ids: string[] = []
  let loc = locateNode(rootNodes, id)
  while (loc) {
    if (loc.index > 0) ids.unshift(loc.node.id)
    loc = loc.parent ? locateNode(rootNodes, loc.parent.id) : null
  }
  return ids
}

/** In quante varianti (parentesi) è annidato il nodo, dentro questo albero */
export const variationDepth = (rootNodes: ChessMoveNode[], id: string): number =>
  variationRootsOnPath(rootNodes, id).length

/** Dopo la mossa c'è qualcosa da stampare e il blocco può essere diviso */
export const canSplitAt = (tree: ChessTree, nodeId: string): boolean =>
  !tree.endNodeId && splitPoints(tree.rootNodes, nodeId).length > 0

/** Ultima mossa stampata dal blocco: fine della linea principale, o della variante rimasta aperta più interna */
export const printedEnd = (tree: ChessTree): ChessMoveNode | null => {
  let node: ChessMoveNode | undefined = tree.rootNodes[0]
  if (tree.endNodeId && tree.openCount) {
    const roots = variationRootsOnPath(tree.rootNodes, tree.endNodeId).slice(0, tree.openCount)
    const innermost = roots.length ? findNode(tree.rootNodes, roots[roots.length - 1]) : null
    node = innermost ?? undefined
  }
  while (node && node.children.length > 0) node = node.children[0]
  return node ?? null
}

/** Ultima mossa della linea principale */
export const mainLineEnd = (tree: ChessTree): ChessMoveNode | null => {
  let node: ChessMoveNode | undefined = tree.rootNodes[0]
  while (node && node.children.length > 0) node = node.children[0]
  return node ?? null
}

/** B nasce da una divisione di A, parte dove A finisce e allo stesso livello di parentesi */
const continuesSplit = (a: ChessTree, b: ChessTree): boolean => {
  if (b.parentTreeId !== a.id || !b.splitAtNodeId) return false
  const end = printedEnd(a)
  if (!end || end.id !== b.splitAtNodeId) return false
  if (!samePosition(end.fen, b.startingFen)) return false
  return (a.depthStart ?? 0) + variationDepth(a.rootNodes, end.id) === (b.depthStart ?? 0)
}

/** Alberi indipendenti: B riparte dalla posizione in cui finisce la linea principale di A, con A senza parentesi in sospeso */
const joinsAtMainLineEnd = (a: ChessTree, b: ChessTree): boolean => {
  if (a.endNodeId || a.closeParens) return false
  const end = mainLineEnd(a)
  return !!end && samePosition(end.fen, b.startingFen) && (a.depthStart ?? 0) === (b.depthStart ?? 0)
}

export const canMergeInto = (a: ChessTree, b: ChessTree): boolean =>
  a.id !== b.id && (continuesSplit(a, b) || joinsAtMainLineEnd(a, b))

/** Blocco, dopo A nel documento, che si può unire ad A (derivato da A, oppure il blocco immediatamente successivo) */
export const findMergeableChild = (a: ChessTree, trees: ChessTree[], docTreeIds: string[]): ChessTree | null => {
  const from = docTreeIds.indexOf(a.id)
  if (from < 0) return null
  const following = docTreeIds.slice(from + 1)
    .map(id => trees.find(t => t.id === id))
    .filter((t): t is ChessTree => !!t)
  return following.find(t => continuesSplit(a, t))
    ?? (following[0] && joinsAtMainLineEnd(a, following[0]) ? following[0] : null)
}

/** Ricalcola numero, colore e FEN dei nodi rigiocando le mosse da `fen` (visita iterativa) */
export const renumberFrom = (fen: string, nodes: ChessMoveNode[]): void => {
  const stack = nodes.map(n => ({ n, parentFen: fen }))
  while (stack.length) {
    const { n, parentFen } = stack.pop()!
    const chess = new Chess(parentFen)
    n.color = chess.turn()
    n.moveNumber = chess.moveNumber()
    chess.move(n.san)
    n.fen = chess.fen()
    for (const c of n.children) stack.push({ n: c, parentFen: n.fen })
  }
}

// ---------------------------------------------------------------------------
// Riordino delle varianti: la linea principale è sempre children[0] (rootNodes[0] alla radice),
// quindi promuovere o abbassare significa riordinare i fratelli. id, FEN, numero, colore,
// commenti, NAG e frecce restano dov'erano: dipendono dal padre, non dalla posizione.
// ---------------------------------------------------------------------------

/** Linea da far salire: il nodo o l'antenato più vicino che ha una mossa alternativa prima di sé */
export const promoteTarget = (rootNodes: ChessMoveNode[], id: string): NodeLocation | null =>
  findLine(rootNodes, id, l => l.index > 0)

/** Linea da far scendere: il nodo o l'antenato più vicino che ha una mossa alternativa dopo di sé */
export const demoteTarget = (rootNodes: ChessMoveNode[], id: string): NodeLocation | null =>
  findLine(rootNodes, id, l => l.index < l.siblings.length - 1)

/** Scambia il nodo con il fratello precedente (-1) o successivo (+1), sul posto. false = già al limite. */
export const moveSibling = (loc: NodeLocation, delta: 1 | -1): boolean => {
  const to = loc.index + delta
  if (to < 0 || to >= loc.siblings.length) return false
  loc.siblings.splice(loc.index, 1)
  loc.siblings.splice(to, 0, loc.node)
  return true
}

/** Porta in prima posizione la linea del nodo a ogni livello di annidamento. Restituisce quante varianti ha spostato. */
export const makeMainLine = (rootNodes: ChessMoveNode[], id: string): number => {
  let moved = 0
  for (;;) {
    const loc = promoteTarget(rootNodes, id)
    if (!loc) return moved
    loc.siblings.splice(loc.index, 1)
    loc.siblings.unshift(loc.node)
    moved++
  }
}

/**
 * Perché l'albero non si può riordinare (null = si può).
 * Gli alberi divisi (splitTree) memorizzano parentesi aperte e punti di taglio che dipendono
 * dall'ordine dei fratelli: finché non si uniscono i blocchi, il riordino è bloccato.
 */
export const reorderBlockedReason = (tree: ChessTree, trees: ChessTree[]): string | null => {
  const split = tree.endNodeId || tree.closeParens || tree.depthStart || tree.parentTreeId || tree.splitAtNodeId
  if (split || trees.some(t => t.parentTreeId === tree.id)) {
    return 'Albero diviso in più blocchi: unisci prima i blocchi per riordinare le varianti.'
  }
  return null
}