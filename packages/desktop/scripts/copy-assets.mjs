import { copyFileSync, cpSync, existsSync, mkdirSync, realpathSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'resources')
rmSync(out, { recursive: true, force: true })

// Font: unica fonte, quella dell'app
const fonts = path.resolve(root, '../app/src/assets/fonts')
if (!existsSync(fonts)) throw new Error(`Cartella dei font non trovata: ${fonts}`)
cpSync(fonts, path.join(out, 'fonts'), { recursive: true })

// pdfjs: build "legacy", la stessa usata dal server
const pdfjs = realpathSync(path.join(root, 'node_modules', 'pdfjs-dist'))
mkdirSync(path.join(out, 'pdfjs'), { recursive: true })
for (const file of ['pdf.mjs', 'pdf.worker.mjs']) {
  const from = path.join(pdfjs, 'legacy', 'build', file)
  if (!existsSync(from)) throw new Error(`File pdfjs non trovato: ${from}`)
  copyFileSync(from, path.join(out, 'pdfjs', file))
}
console.log('Asset copiati in', out)