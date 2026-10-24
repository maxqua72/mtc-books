// Operazioni pure sugli alberi di mosse (prima dentro chessTreeStore.ts e pgnImport.ts)
import type { ChessMoveNode, ChessTree } from '../stores/chessTreeStore'
import { newId } from './ids'

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
})
