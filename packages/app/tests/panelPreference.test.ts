import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoCollapsedFor, effectiveCollapsed } from '../src/utils/panelPreference'

const open = { sections: false, board: false }
const none = { sections: null, board: null }

test('finestra larga: nessuna colonna ridotta in automatico', () => {
  assert.deepEqual(autoCollapsedFor(1400), open)
})

test('finestra di 960 px: si riducono le sezioni, la scacchiera resta', () => {
  assert.deepEqual(autoCollapsedFor(960), { sections: true, board: false })
})

test('finestra molto stretta: si riducono tutte e due', () => {
  assert.deepEqual(autoCollapsedFor(800), { sections: true, board: true })
})

test('la preferenza salvata vale anche con la finestra larga', () => {
  assert.deepEqual(effectiveCollapsed({ sections: true, board: false }, none, open), { sections: true, board: false })
})

test('riaprire una colonna ridotta per la larghezza vale per ora', () => {
  const auto = autoCollapsedFor(960)
  assert.deepEqual(effectiveCollapsed(open, { sections: false, board: null }, auto), open)
})
