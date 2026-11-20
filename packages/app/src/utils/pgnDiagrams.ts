// Diagrammi indicati nel PGN: l'albero importato si divide dopo ogni mossa marcata, come con «Inserisci Diagramma»
import type { ChessMoveNode, ChessTree } from '../stores/chessTreeStore'
import type { BoardShape } from './shapes'
import type { PgnDiagramMarks } from './pgnImport'
import { canSplitAt, findNode } from './treeOps'

/** Cosa inserire nel documento, in ordine: blocchi albero e diagrammi */
export type InsertItem =
  | { kind: 'tree'; id: string }
  | { kind: 'diagram'; fen: string; shapes: BoardShape[] | null }

/** Le operazioni dello store che servono (chessTreeStore) */
interface TreeOps {
  trees: ChessTree[]
  splitTree(treeId: string, nodeId: string): string[] | null
}

/** Ordine di stampa delle mosse: mossa, le sue alternative (intere), poi la continuazione */
export function printOrder(nodes: ChessMoveNode[]): string[] {
  const order: string[] = []
  const walk = (level: ChessMoveNode[]) => {
    let current = level
    while (current.length) {
      const [main, ...alternatives] = current
      order.push(main.id)
      for (const alt of alternatives) walk([alt])
      current = main.children
    }
  }
  walk(nodes)
  return order
}

/**
 * Divide `tree` (già nello store) dopo ogni mossa marcata e restituisce blocchi e diagrammi in ordine di stampa.
 * Una mossa dopo cui non resta niente da stampare ha il diagramma dopo il suo blocco. `skipped`: marcatori
 * che non si possono soddisfare (mossa dentro un blocco che lascia varianti aperte).
 */
export function splitForDiagrams(store: TreeOps, tree: ChessTree, marks: PgnDiagramMarks): { items: InsertItem[]; skipped: number } {
  const items: InsertItem[] = []
  if (marks.atStart) items.push({ kind: 'diagram', fen: tree.startingFen, shapes: null })
  items.push({ kind: 'tree', id: tree.id })

  const rank = new Map(printOrder(tree.rootNodes).map((id, i) => [id, i]))
  const ordered = [...new Set(marks.afterNodeIds)]
    .filter(id => rank.has(id))
    .sort((a, b) => rank.get(a)! - rank.get(b)!)

  const treeById = (id: string) => store.trees.find(t => t.id === id)
  let skipped = 0

  for (const nodeId of ordered) {
    const index = items.findIndex(it => it.kind === 'tree' && !!findNode(treeById(it.id)?.rootNodes, nodeId))
    const segment = index >= 0 ? treeById((items[index] as { id: string }).id) : undefined
    const node = segment ? findNode(segment.rootNodes, nodeId) : null
    if (!segment || !node) { skipped++; continue }

    const diagram: InsertItem = { kind: 'diagram', fen: node.fen, shapes: node.shapes?.length ? node.shapes : null }
    if (canSplitAt(segment, nodeId)) {
      const newIds = store.splitTree(segment.id, nodeId)
      if (!newIds) { skipped++; continue }
      items.splice(index + 1, 0, diagram, ...newIds.map(id => ({ kind: 'tree' as const, id })))
    } else if (!segment.endNodeId) {
      items.splice(index + 1, 0, diagram)   // niente da stampare dopo la mossa: diagramma dopo il blocco
    } else {
      skipped++
    }
  }
  return { items, skipped }
}
