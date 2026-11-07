import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectSymbols, symbolsLegendHtml } from '../src/utils/generatedSections'
import type { ChessMoveNode, ChessTree } from '../src/stores/chessTreeStore'

let seq = 0
const node = (san: string, nags?: number[], children: ChessMoveNode[] = []): ChessMoveNode =>
  ({ id: `n${seq++}`, san, fen: '', moveNumber: 1, color: 'w', parentId: null, comment: null, nags, children })
const tree = (...rootNodes: ChessMoveNode[]): ChessTree =>
  ({ id: `t${seq++}`, title: '', startingFen: '', rootNodes, activeNodeId: null })

test('legenda: raccoglie i simboli delle mosse, varianti comprese, e scacco e matto', () => {
  const used = collectSymbols([
    tree(node('e4', [1], [node('e5', undefined, [node('Qh5', [6])]), node('c5', [5])])),
    tree(node('Qxf7#', [3])),
  ])
  assert.deepEqual([...used.nags].sort((a, b) => a - b), [1, 3, 5, 6])
  assert.equal(used.mate, true)
  assert.equal(used.check, false)
  assert.equal(collectSymbols([tree(node('Bb5+'))]).check, true)
})

test('legenda: solo i simboli usati, nei gruppi della palette, con il titolo per l’indice', () => {
  const html = symbolsLegendHtml('Legenda dei simboli', { nags: new Set([1, 18]), check: true, mate: false })
  assert.match(html, /<h2 data-toc-level="1"[^>]*>Legenda dei simboli<\/h2>/)
  assert.match(html, />Mosse</)
  assert.match(html, />\+<\/strong> <span>Scacco</)
  assert.match(html, />Qualità della mossa</)
  assert.match(html, />!<\/strong> <span>Buona mossa</)
  assert.match(html, />Valutazione della posizione</)
  assert.doesNotMatch(html, /Errore|Scacco matto|Altri simboli/)
})

test('legenda: senza simboli lo dice', () => {
  assert.match(symbolsLegendHtml('Legenda', { nags: new Set(), check: false, mate: false }), /non ci sono ancora simboli/)
})
