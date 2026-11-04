import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY_PLACEMENT, STANDARD_PLACEMENT, availableCastling, composeFen, parseEditorOptions, positionError,
} from '../src/utils/boardEditor'
import { STANDARD_FEN } from '../src/utils/fen'

const all = { K: true, Q: true, k: true, q: true }

test('dal FEN alle opzioni e ritorno', () => {
  const options = parseEditorOptions(STANDARD_FEN)
  assert.deepEqual(options, { turn: 'w', castling: all, moveNumber: 1 })
  assert.equal(composeFen(STANDARD_PLACEMENT, options), STANDARD_FEN)
})

test('tratto al Nero e numero di mossa', () => {
  const options = parseEditorOptions('4k3/8/8/8/8/8/8/4K3 b - - 3 24')
  assert.equal(options.turn, 'b')
  assert.equal(options.moveNumber, 24)
  assert.equal(composeFen('4k3/8/8/8/8/8/8/4K3', options), '4k3/8/8/8/8/8/8/4K3 b - - 0 24')
})

test('l\'en passant e la regola delle 50 mosse non passano dall\'editor', () => {
  const fen = 'rnbqkbnr/pp1ppppp/8/2pP4/8/8/PPP1PPPP/RNBQKBNR b KQkq d3 7 12'
  assert.equal(composeFen(fen.split(' ')[0], parseEditorOptions(fen)).split(' ').slice(3).join(' '), '- 0 12')
})

test('un arrocco senza re o torre al loro posto viene tolto', () => {
  assert.deepEqual(availableCastling(STANDARD_PLACEMENT), all)
  const placement = 'r3k3/8/8/8/8/8/8/4K2R'
  assert.deepEqual(availableCastling(placement), { K: true, Q: false, k: false, q: true })
  assert.equal(composeFen(placement, { turn: 'w', castling: all, moveNumber: 1 }), 'r3k3/8/8/8/8/8/8/4K2R w Kq - 0 1')
  assert.equal(composeFen('r3k2r/8/8/8/8/8/8/3K4', { turn: 'w', castling: { ...all, k: false }, moveNumber: 1 }), 'r3k2r/8/8/8/8/8/8/3K4 w q - 0 1')
})

test('numero di mossa non valido', () => {
  assert.match(composeFen('4k3/8/8/8/8/8/8/4K3', { turn: 'w', castling: all, moveNumber: 0 }), / 1$/)
})

test('re mancanti o doppi', () => {
  const fen = (p: string) => `${p} w - - 0 1`
  assert.equal(positionError(fen(EMPTY_PLACEMENT)), 'Manca il re bianco.')
  assert.equal(positionError(fen('8/8/8/8/8/8/8/4K3')), 'Manca il re nero.')
  assert.equal(positionError(fen('4k3/8/8/8/8/8/8/K3K3')), 'C\'è più di un re bianco.')
  assert.equal(positionError(fen('k3k3/8/8/8/8/8/8/4K3')), 'C\'è più di un re nero.')
})

test('pedoni su prima o ottava traversa', () => {
  assert.match(positionError('P3k3/8/8/8/8/8/8/4K3 w - - 0 1')!, /pedoni/)
  assert.match(positionError('4k3/8/8/8/8/8/8/p3K3 w - - 0 1')!, /pedoni/)
})

test('il re di chi non ha il tratto non può essere sotto scacco', () => {
  assert.match(positionError('4k3/8/8/8/8/8/8/4R1K1 w - - 0 1')!, /re nero/)
  assert.equal(positionError('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1'), null)
  assert.match(positionError('8/8/8/3kK3/8/8/8/8 w - - 0 1')!, /sotto scacco/)
})

test('matto e stallo sono posizioni valide', () => {
  assert.equal(positionError('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 1'), null)
  assert.equal(positionError('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), null)
})
