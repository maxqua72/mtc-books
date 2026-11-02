import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createDesktopPdfEngine } from './pdf/engine.js'
import { parseBook, parseChapter } from './pdf/validate.js'

export async function runRenderCli(payloadFile?: string, kind?: string, out?: string): Promise<number> {
  if (!payloadFile || !out || (kind !== 'chapter' && kind !== 'book')) {
    console.error('Uso: --render-payload <payload.json> <chapter|book> <uscita.pdf>')
    return 2
  }
  console.log(`Chromium ${process.versions.chrome}, Electron ${process.versions.electron}`)
  const raw = JSON.parse(await readFile(payloadFile, 'utf-8'))
  const engine = createDesktopPdfEngine((stage) => console.log('  fase:', stage))
  const started = Date.now()

  let pdf: Uint8Array
  if (kind === 'chapter') {
    const req = parseChapter({ title: 'cli', ...raw })
    if (!req) { console.error('Payload del capitolo non valido.'); return 1 }
    pdf = await engine.generateChapter(req)
  } else {
    const req = parseBook({ bookTitle: 'cli', ...raw })
    if (!req) { console.error('Payload del libro non valido.'); return 1 }
    pdf = await engine.generateBook(req)
  }
  await writeFile(path.resolve(out), pdf)
  console.log(`Scritto ${out} in ${((Date.now() - started) / 1000).toFixed(1)} s`)
  return 0
}

import { EngineManager } from './engine/engineManager.js'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** --engine-probe <motore> [FEN]: handshake, opzioni e 2 secondi di analisi con 2 linee */
export async function runEngineProbe(enginePath?: string, fen: string = START): Promise<number> {
  if (!enginePath) { console.error('Uso: --engine-probe <percorso-motore> [FEN]'); return 2 }
  let lines: import('@mtc/shared').AnalysisLine[] = []
  let finished: { bestMove: string | null; reason: string } | null = null
  const manager = new EngineManager({
    onState: (s) => console.log(`  stato: ${s.status}${s.error ? ' — ' + s.error.message : ''}`),
    onOptions: () => {},
    onUpdate: (u) => { lines = u.lines },
    onFinished: (f) => { finished = f },
  })

  await manager.start({ profileId: null, path: enginePath, args: [], options: {} })
  const st = manager.getState()
  if (st.status !== 'ready') return 1
  console.log(`Motore: ${st.engineName} — ${st.engineAuthor}`)
  for (const o of manager.getOptions()) {
    const range = o.type === 'spin' ? ` [${o.min}..${o.max}]` : o.vars.length ? ` {${o.vars.join('|')}}` : ''
    console.log(`  ${o.featured ? '*' : ' '} ${o.name} (${o.type}${range}) = ${o.value ?? '—'}`)
  }

  if (manager.getOptions().some((o) => o.name === 'MultiPV')) await manager.setOption('MultiPV', '2')
  manager.analyze({ id: 1, fen, mode: 'time', depth: 20, timeMs: 2000, newGame: true })
  const start = Date.now()
  while (!finished && Date.now() - start < 8000) await new Promise((r) => setTimeout(r, 50))

  console.log(`Analisi: ${(finished as { reason: string } | null)?.reason ?? 'scaduta'}, mossa migliore ${(finished as { bestMove: string | null } | null)?.bestMove}`)
  for (const l of lines) {
    const s = l.score ? (l.score.kind === 'mate' ? `#${l.score.value}` : (l.score.value / 100).toFixed(2)) : '?'
    console.log(`  ${l.multipv}. profondità ${l.depth}  valutazione ${s} (Bianco)  ${l.pv.slice(0, 8).join(' ')}`)
  }
  await manager.stop()
  return lines.length > 0 ? 0 : 1
}