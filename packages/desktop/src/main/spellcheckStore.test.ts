import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { cleanSpellcheckSettings } from '@mtc/shared'
import { SpellcheckStore } from './spellcheckStore.js'

async function withStore(run: (store: SpellcheckStore, file: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'mtc-spell-'))
  const file = path.join(dir, 'spellcheck-settings.json')
  try { await run(new SpellcheckStore(file), file) } finally { await rm(dir, { recursive: true, force: true }) }
}

test('di partenza è spento', () => withStore(async (store) => {
  await store.load()
  assert.deepEqual(store.data, { enabled: false, languages: ['it-IT'] })
}))

test('salva e rilegge le scelte', () => withStore(async (store, file) => {
  await store.save({ enabled: true, languages: ['en-US', 'it-IT'] })
  const other = new SpellcheckStore(file)
  await other.load()
  assert.equal(other.data.enabled, true)
  assert.deepEqual(other.data.languages, ['it-IT', 'en-US'])
}))

test('un file rovinato non attiva nulla', () => withStore(async (store, file) => {
  await writeFile(file, '{ non è json')
  await store.load()
  assert.equal(store.data.enabled, false)
}))

test('solo lingue previste, almeno una, e attivazione esplicita', () => {
  assert.deepEqual(cleanSpellcheckSettings({ enabled: true, languages: ['xx', 'de-DE'] }), { enabled: true, languages: ['de-DE'] })
  assert.deepEqual(cleanSpellcheckSettings({ enabled: 'true', languages: [] }), { enabled: false, languages: ['it-IT'] })
  assert.deepEqual(cleanSpellcheckSettings(null), { enabled: false, languages: ['it-IT'] })
})
