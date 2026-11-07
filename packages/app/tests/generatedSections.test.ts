import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectGames, collectSymbols, gamesIndexHtml, playersIndexHtml, symbolsLegendHtml } from '../src/utils/generatedSections'
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

const game = (header: Record<string, string>, extra: Partial<ChessTree> = {}): ChessTree =>
  ({ ...tree(node('e4')), header, ...extra })

test('partite: solo alberi con i giocatori, una voce per partita, primo blocco degli alberi divisi', () => {
  const opera = { White: 'Morphy, Paul', Black: 'Duca di Brunswick', Event: 'Parigi', Date: '1858' }
  const a = game(opera)
  const b = game(opera)                                          // stessa partita citata due volte
  const cont = game(opera, { parentTreeId: a.id })               // continuazione di un albero diviso
  const line = tree(node('e4'))                                  // linea d'apertura senza intestazione
  const anon = game({ White: '?', Black: '?' })                  // giocatori sconosciuti
  const reti = game({ White: 'Réti, Richard', Black: 'Tartakower, Savielly', Date: '1910.??.??' })
  const games = collectGames([a, cont, line, anon, b, reti])
  assert.equal(games.length, 2)
  assert.deepEqual(games[0].refs, [`tree-${a.id}`, `tree-${b.id}`])
})

test('indice delle partite: in ordine del Bianco, con evento, anno e riferimenti per le pagine', () => {
  const games = collectGames([
    game({ White: 'Réti, Richard', Black: 'Tartakower, Savielly', Event: 'Vienna', Date: '1910.??.??' }),
    game({ White: 'Anderssen, Adolf', Black: 'Kieseritzky, Lionel', Event: 'Londra', Date: '1851.06.21' }),
  ])
  const html = gamesIndexHtml('Indice delle partite', games)
  assert.match(html, /<h2 data-toc-level="1"[^>]*>Indice delle partite<\/h2>/)
  assert.ok(html.indexOf('Anderssen') < html.indexOf('Réti'))
  assert.match(html, /<strong>Anderssen, Adolf – Kieseritzky, Lionel<\/strong>, Londra 1851/)
  assert.match(html, /data-page-refs="tree-[\w-]+"[^>]*>…</)
})

test('indice dei giocatori: ogni giocatore con le partite da Bianco e da Nero', () => {
  const g1 = game({ White: 'Anderssen, Adolf', Black: 'Kieseritzky, Lionel' })
  const g2 = game({ White: 'Anderssen, Adolf', Black: 'Dufresne, Jean' })
  const g3 = game({ White: 'Morphy, Paul', Black: 'Anderssen, Adolf' })
  const html = playersIndexHtml('Indice dei giocatori', collectGames([g1, g2, g3]))
  const names = [...html.matchAll(/<li[^>]*><span>([^<]+)<\/span>/g)].map((m) => m[1])
  assert.deepEqual(names, ['Anderssen, Adolf', 'Dufresne, Jean', 'Kieseritzky, Lionel', 'Morphy, Paul'])
  assert.match(html, new RegExp(`data-page-refs="tree-${g1.id} tree-${g2.id} tree-${g3.id}"`))
})

test('indici vuoti: lo dicono', () => {
  assert.match(gamesIndexHtml('Partite', []), /non ci sono ancora partite/)
  assert.match(playersIndexHtml('Giocatori', []), /non ci sono ancora giocatori/)
})

test('legenda: senza simboli lo dice', () => {
  assert.match(symbolsLegendHtml('Legenda', { nags: new Set(), check: false, mate: false }), /non ci sono ancora simboli/)
})
