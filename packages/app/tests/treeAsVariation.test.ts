import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useChessTreeStore, type ChessMoveNode } from '../src/stores/chessTreeStore'
import { canMergeInto, printsAsVariation, splitFamily } from '../src/utils/treeOps'
import { sanitizeTrees } from '../src/utils/sanitize'
import { STANDARD_FEN } from '../src/utils/fen'

beforeEach(() => setActivePinia(createPinia()))

/** 1. e4 e5 (1... c5 2. Nf3 d6 3. d4) 2. Nf3 Nc6 — restituisce lo store e la mossa 2. Nf3 della variante */
function buildTree() {
  const store = useChessTreeStore()
  store.trees.push({ id: 'tree-a', title: 'A', startingFen: STANDARD_FEN, rootNodes: [], activeNodeId: null })
  store.activateTree('tree-a')
  for (const m of ['e4', 'e5', 'Nf3', 'Nc6']) store.addMove(m)
  const e4 = store.trees[0].rootNodes[0]
  store.setActiveNode(e4.id)
  for (const m of ['c5', 'Nf3', 'd6', 'd4']) store.addMove(m)
  const c5 = e4.children[1]
  const nf3InVariation = c5.children[0] as ChessMoveNode
  return { store, nf3InVariation }
}

test('un albero nuovo non è stampato come variante finché non lo si imposta', () => {
  const { store } = buildTree()
  assert.equal(printsAsVariation(store.trees[0]), false)
  store.setAsVariation('tree-a', true)
  assert.equal(printsAsVariation(store.trees[0]), true)
  store.setAsVariation('tree-a', false)
  assert.equal(store.trees[0].asVariation, undefined)
})

test('divisione a metà di una sottovariante: i blocchi derivati restano varianti e le parentesi non cambiano', () => {
  const { store, nf3InVariation } = buildTree()
  store.setAsVariation('tree-a', true)

  const ids = store.splitTree('tree-a', nf3InVariation.id)
  assert.ok(ids && ids.length === 2)
  const [inVariation, mainContinuation] = ids.map(id => store.trees.find(t => t.id === id)!)
  const source = store.trees.find(t => t.id === 'tree-a')!

  // Il primo blocco lascia aperta la variante, come in un albero normale
  assert.equal(source.endNodeId, nf3InVariation.id)
  assert.equal(source.openCount, 1)
  // Continuazione dentro la variante (d6 d4): una parentesi già aperta, che chiude
  assert.equal(inVariation.depthStart, 1)
  assert.equal(inVariation.closeParens, 1)
  // Ritorno alla linea di partenza (2. Nf3 Nc6): nessuna parentesi, ma sempre in stile variante
  assert.equal(mainContinuation.depthStart, undefined)
  assert.equal(mainContinuation.closeParens, undefined)
  for (const t of [source, inVariation, mainContinuation]) assert.equal(printsAsVariation(t), true)
})

test('la casella vale per tutti i blocchi dello stesso albero diviso, e i blocchi si riuniscono', () => {
  const { store, nf3InVariation } = buildTree()
  const ids = store.splitTree('tree-a', nf3InVariation.id)!
  assert.deepEqual(splitFamily(store.trees, ids[1]).sort(), ['tree-a', ...ids].sort())

  store.setAsVariation(ids[1], true)
  assert.ok(store.trees.every(t => t.asVariation === true))

  assert.equal(store.mergeTrees('tree-a', ids[0]), true)
  assert.equal(store.mergeTrees('tree-a', ids[1]), true)
  const merged = store.trees.find(t => t.id === 'tree-a')!
  assert.equal(merged.asVariation, true)
  assert.equal(merged.endNodeId, undefined)
  assert.equal(merged.closeParens, undefined)
})

test('alberi indipendenti con stile diverso non si uniscono', () => {
  const store = useChessTreeStore()
  store.trees.push({ id: 'a', title: 'A', startingFen: STANDARD_FEN, rootNodes: [], activeNodeId: null })
  store.activateTree('a')
  store.addMove('e4')
  const fenAfterE4 = store.activeFen
  const b = { id: 'b', title: 'B', startingFen: fenAfterE4, rootNodes: [], activeNodeId: null, asVariation: true }
  store.trees.push(b)
  store.activateTree('b')
  store.addMove('e5')
  const a = store.trees.find(t => t.id === 'a')!
  const bTree = store.trees.find(t => t.id === 'b')!
  assert.equal(canMergeInto(a, bTree), false)
  store.setAsVariation('a', true)
  assert.equal(canMergeInto(a, bTree), true)
})

test('il file conserva l’impostazione e scarta valori non validi', () => {
  const base = { title: 'T', startingFen: STANDARD_FEN, rootNodes: [], activeNodeId: null }
  const [yes, no] = sanitizeTrees([{ ...base, id: 'tree-1', asVariation: true }, { ...base, id: 'tree-2', asVariation: 'sì' }])
  assert.equal(yes.asVariation, true)
  assert.equal('asVariation' in no, false)
})
