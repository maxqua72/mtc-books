// Uso: node scripts/diff-pdf.mjs <a.pdf> <b.pdf> [pagine-da-mostrare]
// Classifica le differenze di testo di ogni pagina: spaziatura, ordine delle parole o contenuto.
import { readFile } from 'node:fs/promises'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

async function readPages(file) {
  const task = pdfjs.getDocument({ data: new Uint8Array(await readFile(file)), verbosity: 0 })
  try {
    const doc = await task.promise
    const pages = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const it of content.items) {
        if (!('str' in it) || !it.str.trim()) continue
        const x = it.transform[4], y = it.transform[5]
        minX = Math.min(minX, x); maxX = Math.max(maxX, x + it.width)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
      const [x0, y0, x1, y1] = page.view
      pages.push({
        text: content.items.map((i) => ('str' in i ? i.str : '')).join('').replace(/\s+/g, ' ').trim(),
        size: [x1 - x0, y1 - y0],
        box: [minX, maxX, minY, maxY],
      })
      page.cleanup()
    }
    return pages
  } finally {
    await task.destroy()
  }
}

const [fa, fb, limitArg] = process.argv.slice(2)
const limit = Number(limitArg) || 6
const [a, b] = await Promise.all([readPages(fa), readPages(fb)])

const f = (n) => (Number.isFinite(n) ? n.toFixed(1) : '-')
const strip = (s) => s.replace(/\s+/g, '')
const bag = (s) => s.split(' ').filter(Boolean).sort().join(' ')

console.log(`Pagine: ${a.length} contro ${b.length}`)
const counts = { spaziatura: 0, ordine: 0, contenuto: 0 }
let shown = 0

for (let i = 0; i < Math.min(a.length, b.length); i++) {
  const A = a[i], B = b[i]
  if (A.text === B.text) continue

  let kind = 'contenuto'
  if (strip(A.text) === strip(B.text)) kind = 'spaziatura'
  else if (bag(A.text) === bag(B.text)) kind = 'ordine'
  counts[kind]++

  if (shown++ >= limit) continue
  let j = 0
  while (j < A.text.length && A.text[j] === B.text[j]) j++
  console.log(`\nPagina ${i + 1}: ${kind}`)
  console.log(`  dimensione: ${f(A.size[0])}x${f(A.size[1])} contro ${f(B.size[0])}x${f(B.size[1])} pt`)
  console.log(`  testo x ${f(A.box[0])}..${f(A.box[1])}, y ${f(A.box[2])}..${f(A.box[3])}`)
  console.log(`          x ${f(B.box[0])}..${f(B.box[1])}, y ${f(B.box[2])}..${f(B.box[3])}`)
  console.log(`  caratteri: ${A.text.length} contro ${B.text.length}`)
  console.log(`  A: ...${A.text.slice(Math.max(0, j - 30), j + 60)}`)
  console.log(`  B: ...${B.text.slice(Math.max(0, j - 30), j + 60)}`)
}

console.log(`\nRiepilogo: ${counts.spaziatura} solo spaziatura, ${counts.ordine} stesse parole in ordine diverso, ${counts.contenuto} contenuto diverso`)