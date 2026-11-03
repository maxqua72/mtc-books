import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { writeAtomic } from './fsUtil.js'

async function withDir(run: (dir: string, target: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'mtc-atomic-'))
  try { await run(dir, path.join(dir, 'libro.mtcbook')) } finally { await rm(dir, { recursive: true, force: true }) }
}

const bytes = (s: string) => new TextEncoder().encode(s)
const failure = (code: string) => Object.assign(new Error(code), { code })

test('sostituisce il file e non lascia temporanei', () => withDir(async (dir, target) => {
  await writeFile(target, 'vecchio')
  await writeAtomic(target, bytes('nuovo'))
  assert.equal(await readFile(target, 'utf-8'), 'nuovo')
  assert.deepEqual(await readdir(dir), ['libro.mtcbook'])
}))

test('riprova se il file è occupato per un attimo', () => withDir(async (dir, target) => {
  await writeFile(target, 'vecchio')
  let calls = 0
  const flaky: typeof rename = async (from, to) => {
    if (++calls <= 2) throw failure('EPERM')
    return rename(from, to)
  }
  await writeAtomic(target, bytes('nuovo'), flaky)
  assert.equal(calls, 3)
  assert.equal(await readFile(target, 'utf-8'), 'nuovo')
  assert.deepEqual(await readdir(dir), ['libro.mtcbook'])
}))

test('errore definitivo: destinazione intatta e nessun temporaneo', () => withDir(async (dir, target) => {
  await writeFile(target, 'vecchio')
  let calls = 0
  const broken: typeof rename = async () => { calls++; throw failure('ENOSPC') }
  await assert.rejects(writeAtomic(target, bytes('nuovo'), broken), /ENOSPC/)
  assert.equal(calls, 1) // non è un errore temporaneo: nessun nuovo tentativo
  assert.equal(await readFile(target, 'utf-8'), 'vecchio')
  assert.deepEqual(await readdir(dir), ['libro.mtcbook'])
}))
