// Uso: node scripts/diff-pdf-masked.mjs <a.pdf> <b.pdf>
// Confronta il testo di ogni pagina escludendo le scacchiere (font Chess Merida) e mostra cosa contengono in B.
import { readFile } from 'node:fs/promises'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

async function pageTexts(file) {
  const task = pdfjs.getDocument({ data: new Uint8Array(await readFile(file)), verbosity: 0 })
  try {
    const doc = await task.promise
    const out = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      out.push(content.items.map((i) => ('str' in i ? i.str : '')).join('').replace(/\s+/g, ' ').trim())
      page.cleanup()
    }
    return out
  } finally {
    await task.destroy()
  }
}

// Scacchiera: riga alta "1222222223", otto traverse, riga bassa "7" + coordinate + "9"
const BOARD = /1222222223.*?7[ÈÉÊËÌÍÎÏ]{8}9/gs
const hex = (s) => [...s].map((c) => c.codePointAt(0).toString(16)).join(' ')

const [fa, fb] = process.argv.slice(2)
const [a, b] = await Promise.all([pageTexts(fa), pageTexts(fb)])

let raw = 0, other = 0, boards = 0, evidence = false
for (let i = 0; i < Math.min(a.length, b.length); i++) {
  if (a[i] === b[i]) continue
  raw++

  let ta = '', tb = '', last = 0, firstBoard = null
  for (const m of a[i].matchAll(BOARD)) {
    ta += a[i].slice(last, m.index)
    tb += b[i].slice(last, m.index)
    last = m.index + m[0].length
    boards++
    firstBoard ??= m
  }
  ta += a[i].slice(last)
  tb += b[i].slice(last)

  if (!evidence && firstBoard) {
    evidence = true
    console.log(`Esempio, pagina ${i + 1}: codici dei primi 12 caratteri della scacchiera`)
    console.log('  Playwright:', hex(a[i].slice(firstBoard.index, firstBoard.index + 12)))
    console.log('  Electron:  ', hex(b[i].slice(firstBoard.index, firstBoard.index + 12)))
  }

  if (a[i].length !== b[i].length || ta !== tb) {
    other++
    let j = 0
    while (j < ta.length && ta[j] === tb[j]) j++
    console.log(`\nPagina ${i + 1}: differenza FUORI dalle scacchiere (caratteri ${a[i].length} contro ${b[i].length})`)
    console.log(`  A: ...${ta.slice(Math.max(0, j - 30), j + 50)}`)
    console.log(`  B: ...${tb.slice(Math.max(0, j - 30), j + 50)}`)
  }
}

console.log(`\nPagine: ${a.length} contro ${b.length}`)
console.log(`Pagine con testo diverso: ${raw}; scacchiere escluse: ${boards}; differenze fuori dalle scacchiere: ${other}`)
process.exit(other || a.length !== b.length ? 1 : 0)