import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanZoom } from '../src/utils/zoomPreference'

test('zoom salvato: valori ammessi', () => {
  assert.equal(cleanZoom('fit-width'), 'fit-width')
  assert.equal(cleanZoom('125'), '125')
})

test('zoom salvato: valori assenti o rovinati tornano al 100%', () => {
  assert.equal(cleanZoom(null), '100')
  assert.equal(cleanZoom('999'), '100')
  assert.equal(cleanZoom(''), '100')
})
