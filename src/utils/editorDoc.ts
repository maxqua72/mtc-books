// Helper puri sul documento ProseMirror dell'editor del libro
import type { Node as PMNode } from '@tiptap/pm/model'

/** treeId dei blocchi albero presenti nel documento */
export const treeIdsInDoc = (doc: PMNode): string[] => {
  const ids: string[] = []
  doc.descendants((node) => {
    if (node.type.name === 'chessTreeBlock' && node.attrs.treeId) ids.push(node.attrs.treeId)
  })
  return ids
}

/** Posizione e dimensione del blocco che mostra l'albero indicato */
export const findTreeBlockPos = (doc: PMNode, treeId: string): { pos: number; size: number } | null => {
  let found: { pos: number; size: number } | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name === 'chessTreeBlock' && node.attrs.treeId === treeId) {
      found = { pos, size: node.nodeSize }
      return false
    }
  })
  return found
}
