import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { useChessTreeStore, type ChessMoveNode } from '../src/stores/chessTreeStore'
import { parsePgnText, buildTreeFromGame } from '../src/utils/pgnImport'
import { splitForDiagrams } from '../src/utils/pgnDiagrams'
import { findNode } from '../src/utils/treeOps'

beforeEach(() => setActivePinia(createPinia()))

// Partita esportata da ChessBase con due diagrammi: dopo 26. Bxf5 e dopo 47... Qf3
const CHESSBASE = readFileSync(new URL('./fixtures/chessbase-diagrams.pgn', import.meta.url), 'utf8')

const allNodes = (nodes: ChessMoveNode[]): ChessMoveNode[] =>
  nodes.flatMap(n => [n, ...allNodes(n.children)])

const importOne = (pgn: string) => {
  const { games } = parsePgnText(pgn)
  assert.equal(games.length, 1)
  return buildTreeFromGame(games[0])
}

test('ChessBase: [#] nel commento dopo la mossa diventa un diagramma dopo quella mossa', () => {
  const { tree, stats, marks } = importOne(CHESSBASE)
  assert.equal(stats.diagrams, 2)
  assert.equal(marks.atStart, false)
  const marked = marks.afterNodeIds.map(id => findNode(tree.rootNodes, id)!)
  assert.deepEqual(marked.map(n => `${n.moveNumber}${n.color === 'w' ? '.' : '...'}${n.san}`), ['26.Bxf5', '47...Qf3'])
})

test('ChessBase: il marcatore non resta nel testo del commento', () => {
  const { tree, marks } = importOne(CHESSBASE)
  assert.ok(allNodes(tree.rootNodes).every(n => !n.comment?.includes('[#]')))
  const qf3 = findNode(tree.rootNodes, marks.afterNodeIds[1])!
  assert.equal(qf3.comment, '( -&gt; ...h3)')
})

test('ChessBase: l’albero si divide nei due punti, con i diagrammi in ordine di stampa', () => {
  const { tree, marks } = importOne(CHESSBASE)
  const store = useChessTreeStore()
  store.trees.push(tree)
  const fens = marks.afterNodeIds.map(id => findNode(tree.rootNodes, id)!.fen)

  const { items, skipped } = splitForDiagrams(store, tree, marks)
  assert.equal(skipped, 0)
  const diagrams = items.filter(it => it.kind === 'diagram')
  assert.deepEqual(diagrams.map(d => d.kind === 'diagram' && d.fen), fens)
  // blocco, diagramma, continuazione..., diagramma, continuazione
  assert.equal(items[0].kind, 'tree')
  assert.equal(items[1].kind, 'diagram')
  assert.equal(items[items.length - 1].kind, 'tree')
})

test('Un # da solo nel commento (scacco matto) non è un diagramma', () => {
  const { stats } = importOne('1. e4 {minaccia Qh5#} e5 *')
  assert.equal(stats.diagrams, 0)
})

test('Scid: il simbolo 201 è un diagramma e non viene stampato come simbolo', () => {
  const { tree, stats, marks } = importOne('1. e4 $201 e5 2. Nf3 Nc6 *')
  assert.equal(stats.diagrams, 1)
  const e4 = tree.rootNodes[0]
  assert.deepEqual(marks.afterNodeIds, [e4.id])
  assert.equal(e4.nags, undefined)
})

test('Marcatore prima della prima mossa: diagramma della posizione iniziale, prima del blocco', () => {
  const { tree, marks } = importOne('{[#]} 1. e4 e5 *')
  assert.equal(marks.atStart, true)
  const store = useChessTreeStore()
  store.trees.push(tree)
  const { items } = splitForDiagrams(store, tree, marks)
  assert.deepEqual(items.map(it => it.kind), ['diagram', 'tree'])
})

test('Diagramma sull’ultima mossa: dopo il blocco, senza dividere', () => {
  const { tree, marks } = importOne('1. e4 e5 2. Nf3 {[#]} *')
  const store = useChessTreeStore()
  store.trees.push(tree)
  const { items, skipped } = splitForDiagrams(store, tree, marks)
  assert.equal(skipped, 0)
  assert.deepEqual(items.map(it => it.kind), ['tree', 'diagram'])
  assert.equal(store.trees.length, 1)
})
