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