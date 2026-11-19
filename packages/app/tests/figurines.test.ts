import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIGURINES, figurineSegments } from '../src/utils/figurines'

const { cls, map } = FIGURINES.goodcompanions

test('linea del motore: le lettere dei pezzi diventano figurine', () => {
  assert.deepEqual(figurineSegments('1. e4 e5 2. Nf3 Nc6'), [
    { text: '1. e4 e5 2. ', cls: '' },
    { text: map.N, cls },
    { text: 'f3 ', cls: '' },
    { text: map.N, cls },
    { text: 'c6', cls: '' },
  ])
})

test('promozione e mossa all\'inizio del testo', () => {
  assert.deepEqual(figurineSegments('Qxe5 e8=Q+'), [
    { text: map.Q, cls },
    { text: 'xe5 e8=', cls: '' },
    { text: map.Q, cls },
    { text: '+', cls: '' },
  ])
})

test('testo senza mosse e arrocco restano invariati', () => {
  assert.deepEqual(figurineSegments('dopo 5. O-O'), [{ text: 'dopo 5. O-O', cls: '' }])
  assert.deepEqual(figurineSegments(''), [])
})
