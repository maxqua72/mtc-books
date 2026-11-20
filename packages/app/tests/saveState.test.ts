import { test } from 'node:test'
import assert from 'node:assert/strict'
import { saveState, shortFileName, type SaveStateInput } from '../src/utils/saveState'

const desktop: SaveStateInput = { status: 'saved', nativeFiles: true, hasFile: true, fileDirty: false, paused: false, error: false }
const web: SaveStateInput = { ...desktop, nativeFiles: false, hasFile: false }

test('desktop: file aggiornato = doppia spunta, file da aggiornare = spunta', () => {
  assert.equal(saveState(desktop).kind, 'file')
  assert.deepEqual(saveState({ ...desktop, fileDirty: true }), { kind: 'local', label: 'Salvato' })
})

test('scrittura in corso', () => {
  assert.equal(saveState({ ...desktop, status: 'saving' }).kind, 'busy')
  assert.equal(saveState({ ...desktop, status: 'unsaved' }).kind, 'busy')
})

test('desktop: gli avvisi restano visibili anche mentre si scrive', () => {
  assert.equal(saveState({ ...desktop, status: 'saving', hasFile: false }).kind, 'no-file')
  assert.equal(saveState({ ...desktop, status: 'saving', paused: true }).kind, 'paused')
  assert.equal(saveState({ ...desktop, error: true }).kind, 'error')
})

test('web: nessun file associato, conta solo se l’ultimo scaricamento è aggiornato', () => {
  assert.deepEqual(saveState({ ...web, fileDirty: true }), { kind: 'local', label: 'Salvato nel browser' })
  assert.equal(saveState(web).kind, 'file')
})

test('nome del file senza estensione', () => {
  assert.equal(shortFileName('kjhkjhkjh (1).mtcbook'), 'kjhkjhkjh (1)')
  assert.equal(shortFileName('libro.MTCBOOK'), 'libro')
})
