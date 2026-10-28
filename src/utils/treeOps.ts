// Operazioni pure sugli alberi di mosse (prima dentro chessTreeStore.ts e pgnImport.ts)
import type { ChessMoveNode, ChessTree } from '../stores/chessTreeStore'
import { newId } from './ids'
import { samePosition } from './fen'

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

/** B continua A: nasce da una sua divisione, parte dalla posizione in cui A finisce e allo stesso livello di parentesi */
export const canMergeInto = (a: ChessTree, b: ChessTree): boolean => {
  if (b.parentTreeId !== a.id || !b.splitAtNodeId) return false
  const end = printedEnd(a)
  if (!end || end.id !== b.splitAtNodeId) return false
  if (!samePosition(end.fen, b.startingFen)) return false
  return (a.depthStart ?? 0) + variationDepth(a.rootNodes, end.id) === (b.depthStart ?? 0)
}

/** Primo blocco, dopo A nel documento, che si può unire ad A */
export const findMergeableChild = (a: ChessTree, trees: ChessTree[], docTreeIds: string[]): ChessTree | null => {
  const from = docTreeIds.indexOf(a.id)
  if (from < 0) return null
  for (const id of docTreeIds.slice(from + 1)) {
    const t = trees.find(x => x.id === id)
    if (t && canMergeInto(a, t)) return t
  }
  return null
}
