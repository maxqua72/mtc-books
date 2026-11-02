import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatScore, pvToSan, uciToSan } from '../src/utils/uciPv'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

test('linea dalla posizione iniziale', () => {
  const r = pvToSan(START, ['e2e4', 'e7e5', 'g1f3'])
  assert.equal(r.text, '1. e4 e5 2. Nf3')
  assert.equal(r.complete, true)
})

test('se tocca al Nero il numero ha tre punti', () => {
  const r = pvToSan('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', ['e7e5', 'g1f3'])
  assert.equal(r.text, '1... e5 2. Nf3')
})

test('una mossa illegale interrompe la linea', () => {
  const r = pvToSan(START, ['e2e4', 'e2e4', 'g1f3'])
  assert.equal(r.text, '1. e4')
  assert.equal(r.complete, false)
})

test('promozione, arrocco e FEN non valido', () => {
  assert.equal(pvToSan('8/4P2k/8/8/8/8/8/4K3 w - - 0 1', ['e7e8q']).text, '1. e8=Q')
  assert.equal(pvToSan('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['e1g1']).text, '1. O-O')
  assert.deepEqual(pvToSan('non-un-fen', ['e2e4']), { text: '', sans: [], complete: false })
})

test('mossa singola e valutazione', () => {
  assert.equal(uciToSan(START, 'g1f3'), 'Nf3')
  assert.equal(formatScore({ kind: 'cp', value: 35 }), '+0.35')
  assert.equal(formatScore({ kind: 'cp', value: -120 }), '-1.20')
  assert.equal(formatScore({ kind: 'cp', value: 0 }), '0.00')
  assert.equal(formatScore({ kind: 'mate', value: 3 }), '#3')
  assert.equal(formatScore({ kind: 'mate', value: -2 }), '#-2')
  assert.equal(formatScore(null), '…')
})