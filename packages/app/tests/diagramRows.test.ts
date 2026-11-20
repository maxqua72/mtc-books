import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diagramReplacesEmptyParagraph, planPair, type BlockInfo } from '../src/utils/diagramRows'

const D = (align: BlockInfo['align'] = 'center'): BlockInfo => ({ diagram: true, align, emptyParagraph: false })
const P: BlockInfo = { diagram: false, align: 'center', emptyParagraph: true }
const T: BlockInfo = { diagram: false, align: 'center', emptyParagraph: false }

test('inserimento: il paragrafo vuoto dopo un diagramma singolo viene sostituito', () => {
  assert.equal(diagramReplacesEmptyParagraph([T, D(), P], 2), true)
  assert.equal(diagramReplacesEmptyParagraph([T, D('left'), P], 2), true)
})

test('inserimento: il paragrafo vuoto tra due file di diagrammi resta', () => {
  assert.equal(diagramReplacesEmptyParagraph([D('left'), D('right'), P], 2), false)
  assert.equal(diagramReplacesEmptyParagraph([D('right'), D('left'), P], 2), false)
})

test('inserimento: un paragrafo vuoto non dopo un diagramma resta', () => {
  assert.equal(diagramReplacesEmptyParagraph([T, P], 1), false)
  assert.equal(diagramReplacesEmptyParagraph([D(), T], 1), false)
})

test('affianca: diagramma subito prima, o con un paragrafo vuoto in mezzo', () => {
  assert.deepEqual(planPair([T, D(), D()], 2), { previous: 1, emptyBetween: null, done: false })
  assert.deepEqual(planPair([T, D(), P, D()], 3), { previous: 1, emptyBetween: 2, done: false })
  assert.deepEqual(planPair([D('left'), D('right')], 1), { previous: 0, emptyBetween: null, done: true })
})

test('affianca: non disponibile senza diagramma prima o se il precedente chiude già una fila', () => {
  assert.equal(planPair([T, D()], 1), null)
  assert.equal(planPair([D(), T, D()], 2), null)
  assert.equal(planPair([D('left'), D('right'), P, D()], 3), null)
  assert.equal(planPair([D('left'), D('right'), D()], 2), null)
})
