// Uso: node scripts/compare-pdf.mjs <a.pdf> <b.pdf>   (exit 1 se differiscono)
import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function pagesText(file) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await readFile(file)), verbosity: 0 }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    pages.push(content.items.map(i => ('str' in i ? i.str : '')).join('').replace(/\s+/g, ' ').trim());
  }
  //await doc.destroy();
  await doc.cleanup(); 
  return pages;
}

const [fa, fb] = process.argv.slice(2);
const [a, b] = await Promise.all([pagesText(fa), pagesText(fb)]);
let diffs = 0;
if (a.length !== b.length) { console.log(`Pagine: ${a.length} contro ${b.length}`); diffs++; }
for (let i = 0; i < Math.min(a.length, b.length); i++) {
  if (a[i] !== b[i]) { console.log(`Pagina ${i + 1}: testo diverso`); diffs++; }
}
console.log(diffs ? `DIVERSI (${diffs} differenze)` : `UGUALI (${a.length} pagine)`);
process.exit(diffs ? 1 : 0);