import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LineBuffer, cmd, normalizeOptionValue, parseLine, toWhitePov } from './uci.js'

const opt = (line: string) => {
  const m = parseLine(line)
  assert.equal(m.kind, 'option')
  return m.kind === 'option' ? m.option : null
}

test('opzioni: spin, button, check, string, combo, nome con spazi', () => {
  assert.deepEqual(opt('option name Threads type spin default 1 min 1 max 1024'),
    { name: 'Threads', type: 'spin', default: '1', min: 1, max: 1024, vars: [] })
  assert.deepEqual(opt('option name Clear Hash type button'),
    { name: 'Clear Hash', type: 'button', default: null, min: null, max: null, vars: [] })
  assert.equal(opt('option name Skill Level type spin default 20 min 0 max 20')?.name, 'Skill Level')
  assert.equal(opt('option name UCI_LimitStrength type check default false')?.default, 'false')
  assert.equal(opt('option name SyzygyPath type string default <empty>')?.default, '')
  assert.deepEqual(opt('option name Style type combo default Normal var Solid var Normal var Risky')?.vars, ['Solid', 'Normal', 'Risky'])
})

test('info: punteggio, multipv, linea', () => {
  const m = parseLine('info depth 20 seldepth 28 multipv 2 score cp -35 nodes 123456 nps 1500000 hashfull 12 tbhits 0 time 82 pv e7e5 g1f3 b8c6')
  assert.equal(m.kind, 'info')
  if (m.kind !== 'info') return
  assert.deepEqual(m.info.score, { kind: 'cp', value: -35, bound: null })
  assert.equal(m.info.multipv, 2)
  assert.equal(m.info.timeMs, 82)
  assert.deepEqual(m.info.pv, ['e7e5', 'g1f3', 'b8c6'])
})

test('info: matto, limiti, wdl, stringa', () => {
  const mate = parseLine('info depth 30 score mate -3 nodes 10 pv e1e2')
  assert.ok(mate.kind === 'info' && mate.info.score?.kind === 'mate' && mate.info.score.value === -3)
  const bound = parseLine('info depth 12 score cp 20 lowerbound nodes 5 pv e2e4')
  assert.ok(bound.kind === 'info' && bound.info.score?.bound === 'lower')
  const wdl = parseLine('info depth 9 score cp 10 wdl 400 500 100 nodes 5 pv e2e4')
  assert.ok(wdl.kind === 'info' && wdl.info.nodes === 5)
  const str = parseLine('info string NNUE evaluation using nn-1234.nnue')
  assert.ok(str.kind === 'info' && str.info.string === 'NNUE evaluation using nn-1234.nnue')
    // senza profondità, linea o punteggio non c'è nulla di utile: la riga viene ignorata
  assert.equal(parseLine('info currmove e2e4 currmovenumber 1').kind, 'other')
  // con la sola profondità il parser la riconosce, ma senza «pv» il gestore non emette nessun aggiornamento
  const bare = parseLine('info depth 5 currmove e2e4 currmovenumber 1')
  assert.ok(bare.kind === 'info' && bare.info.depth === 5 && bare.info.pv === undefined)
})

test('bestmove', () => {
  assert.deepEqual(parseLine('bestmove e2e4 ponder e7e5'), { kind: 'bestmove', move: 'e2e4', ponder: 'e7e5' })
  assert.deepEqual(parseLine('bestmove (none)'), { kind: 'bestmove', move: null, ponder: null })
})

test('LineBuffer: righe spezzate e CRLF', () => {
  const b = new LineBuffer()
  assert.deepEqual(b.push('uci'), [])
  assert.deepEqual(b.push('ok\r\nread'), ['uciok'])
  assert.deepEqual(b.push('yok\n'), ['readyok'])
})

test('valori delle opzioni', () => {
  const spin = { name: 'Threads', type: 'spin' as const, min: 1, max: 64, vars: [] }
  assert.equal(normalizeOptionValue(spin, '999'), '64')
  assert.equal(normalizeOptionValue(spin, '0'), '1')
  assert.throws(() => normalizeOptionValue(spin, 'abc'))
  const check = { name: 'X', type: 'check' as const, min: null, max: null, vars: [] }
  assert.equal(normalizeOptionValue(check, 'TRUE'), 'true')
  assert.throws(() => normalizeOptionValue(check, 'si'))
  const combo = { name: 'Style', type: 'combo' as const, min: null, max: null, vars: ['Solid', 'Risky'] }
  assert.equal(normalizeOptionValue(combo, 'risky'), 'Risky')
  assert.throws(() => normalizeOptionValue(combo, 'Wild'))
})

test('comandi: niente a capo e valore vuoto', () => {
  assert.throws(() => cmd.position('8/8/8/8/8/8/8/8 w - - 0 1\nquit'))
  assert.equal(cmd.setOption('SyzygyPath', ''), 'setoption name SyzygyPath value <empty>')
  assert.equal(cmd.setOption('Clear Hash'), 'setoption name Clear Hash')
})

test('valutazione dal punto di vista del Bianco', () => {
  assert.deepEqual(toWhitePov({ kind: 'cp', value: 50 }, false), { kind: 'cp', value: -50 })
  assert.deepEqual(toWhitePov({ kind: 'mate', value: 2 }, true), { kind: 'mate', value: 2 })
})