import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BOOK_FORMAT_VERSION, isBookTooNew, readFormatVersion } from '@mtc/shared'
import { defaultMetadata, savedMetadata } from '../src/stores/book/types'

test('versione del formato: i file senza il campo valgono 1', () => {
  assert.equal(readFormatVersion({}), 1)
  assert.equal(readFormatVersion(null), 1)
  assert.equal(readFormatVersion({ formatVersion: 'x' }), 1)
  assert.equal(readFormatVersion({ formatVersion: 3 }), 3)
})

test('solo un formato più recente viene rifiutato', () => {
  assert.equal(isBookTooNew({}), false)
  assert.equal(isBookTooNew({ formatVersion: BOOK_FORMAT_VERSION }), false)
  assert.equal(isBookTooNew({ formatVersion: BOOK_FORMAT_VERSION + 1 }), true)
})

test('i dati di salvataggio non toccano il libro aperto', () => {
  const meta = { ...defaultMetadata(), revision: 4 }
  const saved = savedMetadata(meta, 'desktop', '2026-11-03T22:00:00.000Z')
  assert.equal(saved.revision, 5)
  assert.equal(saved.savedAt, '2026-11-03T22:00:00.000Z')
  assert.equal(saved.savedBy, 'desktop')
  assert.equal(meta.revision, 4)
  assert.equal(meta.savedAt, undefined)
})
