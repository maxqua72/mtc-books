import assert from 'node:assert/strict'
import { test } from 'node:test'
import { splitTooltip } from '../src/utils/tooltipText'

test('tooltip: la scorciatoia finale si separa dal testo', () => {
  assert.deepEqual(splitTooltip('Grassetto (Ctrl+B)'), { text: 'Grassetto', shortcut: 'Ctrl+B' })
  assert.deepEqual(splitTooltip('Riduci rientro (Ctrl+[)'), { text: 'Riduci rientro', shortcut: 'Ctrl+[' })
})

test('tooltip: le altre parentesi restano nel testo', () => {
  const text = 'Inserisci blocco mosse (partita o varianti)'
  assert.deepEqual(splitTooltip(text), { text, shortcut: null })
  assert.deepEqual(splitTooltip('Evidenzia'), { text: 'Evidenzia', shortcut: null })
})
