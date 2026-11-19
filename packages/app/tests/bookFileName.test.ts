import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookFileName } from '../src/utils/bookFileName'

test('nome del file: minuscolo, spazi in trattini bassi', () => {
  assert.equal(bookFileName('Nuovo Libro di Scacchi'), 'nuovo_libro_di_scacchi.mtcbook')
})

test('nome del file: niente caratteri vietati', () => {
  assert.equal(bookFileName('Partite 1/2: "Il Siciliano?"'), 'partite_12_il_siciliano.mtcbook')
})

test('nome del file: titolo vuoto o solo simboli', () => {
  assert.equal(bookFileName(''), 'libro.mtcbook')
  assert.equal(bookFileName('  ??  '), 'libro.mtcbook')
  assert.equal(bookFileName('...'), 'libro.mtcbook')
})
