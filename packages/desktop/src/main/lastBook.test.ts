import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { LastBookStore } from './lastBook.js'

async function withStore(run: (store: LastBookStore, file: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'mtc-last-'))
  const file = path.join(dir, 'last-book.json')
  try { await run(new LastBookStore(file), file) } finally { await rm(dir, { recursive: true, force: true }) }
}

const entry = { path: 'C:\\Libri\\prova.mtcbook', mtimeMs: 1000.5, size: 42 }

test('senza dati non c\'è un ultimo file', () => withStore(async (store) => {
  assert.equal(await store.load(), null)
}))

test('ricorda e dimentica', () => withStore(async (store) => {
  await store.remember(entry)
  assert.deepEqual(await store.load(), entry)
  await store.forget()
  assert.equal(await store.load(), null)
}))

test('dimenticare e ricordare di seguito restano in ordine', () => withStore(async (store) => {
  await store.remember({ ...entry, size: 1 })
  void store.forget()
  void store.remember(entry)
  assert.deepEqual(await store.load(), entry)
}))

test('un file rovinato equivale a nessun dato', () => withStore(async (store, file) => {
  await writeFile(file, '{ non è json')
  assert.equal(await store.load(), null)
  await writeFile(file, JSON.stringify({ path: 7 }))
  assert.equal(await store.load(), null)
}))
