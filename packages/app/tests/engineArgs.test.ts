import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatArgs, parseArgs } from '../src/utils/engineArgs'

test('argomenti: semplici, con virgolette, vuoti', () => {
  assert.deepEqual(parseArgs(''), [])
  assert.deepEqual(parseArgs('--weights net.pb'), ['--weights', 'net.pb'])
  assert.deepEqual(parseArgs('--weights "C:\\Mie Reti\\net.pb" -t 2'), ['--weights', 'C:\\Mie Reti\\net.pb', '-t', '2'])
  assert.deepEqual(parseArgs('""'), [''])
})

test('formato e ritorno', () => {
  const args = ['--weights', 'C:\\Mie Reti\\net.pb', '-t', '2']
  assert.deepEqual(parseArgs(formatArgs(args)), args)
})