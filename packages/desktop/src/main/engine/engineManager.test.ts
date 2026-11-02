import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import type { AnalysisLine, EngineOption, EngineState } from '@mtc/shared'
import { EngineError, EngineManager, type LaunchSpec, type Timeouts } from './engineManager.js'

const FAKE = fileURLToPath(new URL('../../../test/fake-engine.mjs', import.meta.url))
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const BLACK = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

type Ev = { type: 'update' | 'finished'; id: number; lines?: AnalysisLine[]; reason?: string; bestMove?: string | null }

function harness(timeouts: Partial<Timeouts> = {}) {
  const states: EngineState[] = []
  const events: Ev[] = []
  const logs: string[] = []
  let options: EngineOption[] = []
  const manager = new EngineManager({
    onState: (s) => states.push(s),
    onOptions: (o) => { options = o },
    onUpdate: (u) => events.push({ type: 'update', id: u.id, lines: u.lines }),
    onFinished: (f) => events.push({ type: 'finished', ...f }),
    onLog: (l) => logs.push(l),
  }, { handshakeMs: 1500, readyMs: 1500, quitMs: 800, stopMs: 2000, pingEveryMs: 60_000, updateEveryMs: 20, ...timeouts })
  return { manager, states, events, logs, options: () => options }
}

const spec = (options: Record<string, string> = {}): LaunchSpec =>
  ({ profileId: 't', path: process.execPath, args: [FAKE], options })

async function until(cond: () => boolean, ms = 4000) {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('Tempo scaduto in attesa della condizione')
    await new Promise((r) => setTimeout(r, 10))
  }
}

async function withMode<T>(mode: string, fn: () => Promise<T>): Promise<T> {
  process.env.FAKE_MODE = mode
  try { return await fn() } finally { delete process.env.FAKE_MODE }
}

const req = (id: number, fen = START, extra: object = {}) =>
  ({ id, fen, mode: 'infinite' as const, depth: 20, timeMs: 1000, newGame: false, ...extra })

test('avvio: handshake, nome e opzioni', async () => {
  const h = harness()
  try {
    await h.manager.start(spec())
    const st = h.manager.getState()
    assert.equal(st.status, 'ready')
    assert.equal(st.engineName, 'FakeFish 1.0')
    const mp = h.options().find((o) => o.name === 'MultiPV')
    assert.deepEqual([mp?.type, mp?.min, mp?.max, mp?.featured], ['spin', 1, 5, true])
    assert.equal(h.options().find((o) => o.name === 'Clear Hash')?.type, 'button')
    assert.equal(h.options().find((o) => o.name === 'Style')?.vars.length, 3)
  } finally { await h.manager.stop() }
})

test('le opzioni salvate vengono inviate all’avvio', async () => {
  const h = harness()
  try {
    await h.manager.start(spec({ Threads: '4', Style: 'Risky', Inesistente: '1' }))
    assert.equal(h.options().find((o) => o.name === 'Threads')?.value, '4')
    h.manager.analyze(req(1))
    await until(() => h.logs.some((l) => l.includes('Threads=4') && l.includes('Style=Risky')))
  } finally { await h.manager.stop() }
})

test('analisi infinita: aggiornamenti, stop e ritorno a ready', async () => {
  const h = harness()
  try {
    await h.manager.start(spec())
    h.manager.analyze(req(1, START, { newGame: true }))
    await until(() => h.events.some((e) => e.type === 'update' && e.id === 1))
    assert.equal(h.manager.getState().status, 'analyzing')
    h.manager.stopAnalysis()
    await until(() => h.events.some((e) => e.type === 'finished' && e.id === 1))
    assert.equal(h.events.find((e) => e.type === 'finished')?.reason, 'stopped')
    await until(() => h.manager.getState().status === 'ready')
  } finally { await h.manager.stop() }
})

test('profondità fissa: finisce da sola con la mossa migliore', async () => {
  const h = harness()
  try {
    await h.manager.start(spec())
    h.manager.analyze(req(1, START, { mode: 'depth', depth: 4 }))
    await until(() => h.events.some((e) => e.type === 'finished'))
    const f = h.events.find((e) => e.type === 'finished')
    assert.deepEqual([f?.reason, f?.bestMove], ['done', 'e2e4'])
    assert.equal(h.manager.getState().status, 'ready')
  } finally { await h.manager.stop() }
})

test('numero di linee (MultiPV) e valutazione dal punto di vista del Bianco', async () => {
  const h = harness()
  try {
    await h.manager.start(spec())
    assert.equal(await h.manager.setOption('MultiPV', '3'), '3')
    h.manager.analyze(req(1, BLACK))
    await until(() => h.events.some((e) => e.type === 'update' && e.lines?.length === 3))
    const lines = h.events.filter((e) => e.type === 'update').at(-1)!.lines!
    assert.deepEqual(lines.map((l) => l.multipv), [1, 2, 3])
    assert.ok((lines[0].score?.value ?? 0) < 0, 'con il Nero al tratto il punteggio del motore va invertito')
  } finally { await h.manager.stop() }
})

test('l’ultima richiesta vince e non arrivano aggiornamenti della vecchia dopo lo stop', async () => {
  const h = harness()
  try {
    await h.manager.start(spec())
    h.manager.analyze(req(1))
    await until(() => h.events.some((e) => e.type === 'update' && e.id === 1))
    h.manager.analyze(req(2, BLACK))
    await until(() => h.events.some((e) => e.type === 'update' && e.id === 2))
    const fin = h.events.findIndex((e) => e.type === 'finished' && e.id === 1)
    assert.ok(fin >= 0)
    assert.equal(h.events.slice(fin + 1).some((e) => e.type === 'update' && e.id === 1), false)
  } finally { await h.manager.stop() }
})

test('arresto lento: la nuova analisi parte solo dopo bestmove', async () => {
  await withMode('slow-stop', async () => {
    const h = harness()
    try {
      await h.manager.start(spec())
      h.manager.analyze(req(1))
      await until(() => h.events.some((e) => e.type === 'update' && e.id === 1))
      h.manager.analyze(req(2))
      await until(() => h.events.some((e) => e.type === 'update' && e.id === 2))
      const fin = h.events.findIndex((e) => e.type === 'finished' && e.id === 1)
      const first2 = h.events.findIndex((e) => e.type === 'update' && e.id === 2)
      assert.ok(fin >= 0 && fin < first2)
    } finally { await h.manager.stop() }
  })
})

test('opzioni: validazione, correzione dei limiti, combo, pulsante', async () => {
  const h = harness()
  try {
    await h.manager.start(spec())
    await assert.rejects(h.manager.setOption('Nope', '1'), (e) => e instanceof EngineError && e.code === 'invalid-option')
    assert.equal(await h.manager.setOption('Threads', '999'), '64')
    await assert.rejects(h.manager.setOption('Style', 'Wild'), (e) => e instanceof EngineError)
    assert.equal(await h.manager.setOption('Style', 'risky'), 'Risky')
    await h.manager.pressButton('Clear Hash')
    await until(() => h.logs.includes('clear hash'))
    await h.manager.resetOptions()
    assert.equal(h.options().find((o) => o.name === 'Threads')?.value, '1')
  } finally { await h.manager.stop() }
})

test('cambiare un’opzione durante l’analisi la fa ripartire', async () => {
  const h = harness()
  try {
    await h.manager.start(spec())
    h.manager.analyze(req(1))
    await until(() => h.events.some((e) => e.type === 'update' && e.id === 1))
    await h.manager.setOption('MultiPV', '2')
    await until(() => h.events.some((e) => e.type === 'update' && e.id === 1 && e.lines?.length === 2))
    assert.equal(h.manager.getState().status, 'analyzing')
  } finally { await h.manager.stop() }
})

test('crash durante la ricerca', async () => {
  await withMode('crash-on-go', async () => {
    const h = harness()
    try {
      await h.manager.start(spec())
      h.manager.analyze(req(1))
      await until(() => h.manager.getState().status === 'crashed')
      assert.equal(h.manager.getState().error?.code, 'crashed')
      assert.equal(h.events.find((e) => e.type === 'finished')?.reason, 'error')
    } finally { await h.manager.stop() }
  })
})

test('handshake fallito: il programma non parla UCI', async () => {
  await withMode('silent', async () => {
    const h = harness({ handshakeMs: 300 })
    await h.manager.start(spec())
    assert.equal(h.manager.getState().status, 'error')
    assert.equal(h.manager.getState().error?.code, 'handshake-failed')
  })
})

test('eseguibile inesistente', async () => {
  const h = harness()
  await h.manager.start({ profileId: 't', path: 'Z:\\non\\esiste\\motore.exe', args: [], options: {} })
  assert.equal(h.manager.getState().status, 'error')
  assert.equal(h.manager.getState().error?.code, 'spawn-failed')
})

test('stop: chiude il processo e riporta a stopped', async () => {
  const h = harness()
  await h.manager.start(spec())
  h.manager.analyze(req(1))
  await until(() => h.events.some((e) => e.type === 'update'))
  await h.manager.stop()
  assert.equal(h.manager.getState().status, 'stopped')
  assert.throws(() => h.manager.analyze(req(2)), (e) => e instanceof EngineError && e.code === 'not-ready')
})