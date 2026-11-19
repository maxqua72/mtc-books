import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useChessTreeStore, type ChessMoveNode } from '../src/stores/chessTreeStore'
import { findMergeableChild } from '../src/utils/treeOps'
import { STANDARD_FEN } from '../src/utils/fen'

beforeEach(() => setActivePinia(createPinia()))

/** Mosse e varianti dell'albero, senza id né stato: basta a confrontare il contenuto */
const shape = (nodes: ChessMoveNode[]): unknown =>
  nodes.map(n => [n.san, n.moveNumber, n.color, shape(n.children)])

/** 1. e4 e5 (1... c5 2. Nf3 d6 3. d4) 2. Nf3 Nc6 */
function buildTree() {
  const store = useChessTreeStore()
  store.trees.push({ id: 'tree-a', title: 'A', startingFen: STANDARD_FEN, rootNodes: [], activeNodeId: null })
  store.activateTree('tree-a')
  for (const m of ['e4', 'e5', 'Nf3', 'Nc6']) store.addMove(m)
  const e4 = store.trees[0].rootNodes[0]
  store.setActiveNode(e4.id)
  for (const m of ['c5', 'Nf3', 'd6', 'd4']) store.addMove(m)
  return { store, nf3InVariation: e4.children[1].children[0] as ChessMoveNode }
}

/** La stessa sequenza di «Annulla» dopo una divisione (useBlockInsertion.undoSplit), senza l'editor */
function undoSplit(store: ReturnType<typeof useChessTreeStore>, sourceId: string, derivedIds: string[]) {
  const docIds = [sourceId, ...derivedIds]
  const source = store.trees.find(t => t.id === sourceId)!
  for (;;) {
    const b = findMergeableChild(source, store.trees, docIds)
    if (!b || !derivedIds.includes(b.id)) break
    docIds.splice(docIds.indexOf(b.id), 1)
    assert.equal(store.mergeTrees(sourceId, b.id), true)
  }
  return docIds
}

test('Annulla dopo una divisione a metà variante riporta l’albero com’era', () => {
  const { store, nf3InVariation } = buildTree()
  const before = shape(store.trees[0].rootNodes)

  const ids = store.splitTree('tree-a', nf3InVariation.id)!
  assert.equal(ids.length, 2)

  const left = undoSplit(store, 'tree-a', ids)
  assert.deepEqual(left, ['tree-a'])
  const source = store.trees.find(t => t.id === 'tree-a')!
  assert.deepEqual(shape(source.rootNodes), before)
  assert.equal(source.endNodeId, undefined)
  assert.equal(source.openCount, undefined)
  assert.equal(source.closeParens, undefined)
})

test('Annulla dopo una divisione sulla linea principale riporta l’albero com’era', () => {
  const { store } = buildTree()
  const before = shape(store.trees[0].rootNodes)
  const e5 = store.trees[0].rootNodes[0].children[0]

  const ids = store.splitTree('tree-a', e5.id)!
  assert.deepEqual(undoSplit(store, 'tree-a', ids), ['tree-a'])
  assert.deepEqual(shape(store.trees.find(t => t.id === 'tree-a')!.rootNodes), before)
})
