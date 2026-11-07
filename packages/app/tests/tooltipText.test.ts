import assert from 'node:assert/strict'
import { test } from 'node:test'
import { splitTooltip } from '../src/utils/tooltipText'

test('tooltip: la scorciatoia finale si separa dal testo', () => {
  assert.deepEqual(splitTooltip('Grassetto (Ctrl+B)'), { text: 'Grassetto', shortcut: 'Ctrl+B' })
  assert.deepEqual(splitTooltip('Riduci rientro (Ctrl+[)'), { text: 'Riduci rientro', shortcut: 'Ctrl+[' })
  assert.deepEqual(splitTooltip('Annulla (Esc)'), { text: 'Annulla', shortcut: 'Esc' })
  assert.deepEqual(splitTooltip('Donna (Q)'), { text: 'Donna', shortcut: 'Q' })
  assert.deepEqual(splitTooltip('Inizio (Home)'), { text: 'Inizio', shortcut: 'Home' })
  assert.deepEqual(splitTooltip('Mossa precedente (←)'), { text: 'Mossa precedente', shortcut: '←' })
})

test('tooltip: sigle e parole tra parentesi non sono scorciatoie', () => {
  assert.equal(splitTooltip('Esporta (PDF)').shortcut, null)
  assert.equal(splitTooltip('Pezzo (a)').shortcut, null)
  assert.equal(splitTooltip('Modifica didascalia (Invio per confermare)').shortcut, null)
})

test('tooltip: le altre parentesi restano nel testo', () => {
  const text = 'Inserisci blocco mosse (partita o varianti)'
  assert.deepEqual(splitTooltip(text), { text, shortcut: null })
  assert.deepEqual(splitTooltip('Evidenzia'), { text: 'Evidenzia', shortcut: null })
})
