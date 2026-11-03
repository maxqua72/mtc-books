import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createPdfEngine, type BookRequest, type ChapterRequest } from '@mtc/pdf-core'
import { createPlaywrightRenderer } from '../adapters/playwright/playwrightRenderer.js'
import { getFontCss } from './pdfFonts.js'

export { getBrowser } from '../adapters/playwright/playwrightRenderer.js'

/** Per ispezionare l'HTML inviato a Chromium: PDF_DEBUG=1 (cartella opzionale in PDF_DEBUG_DIR) */
const DEBUG_HTML = process.env.PDF_DEBUG === '0'

const engine = createPdfEngine({
  renderer: createPlaywrightRenderer(),
  getFontCss,
  onDebugHtml: DEBUG_HTML
    ? async (name, html) => {
        const debugPath = path.resolve(process.env.PDF_DEBUG_DIR || process.cwd(), name)
        await writeFile(debugPath, html, 'utf-8')
        console.log(`[DEBUG] HTML completo salvato in: ${debugPath}`)
      }
    : undefined,
})

// Le rotte si aspettano un Buffer
export async function generatePdfFromHtml(req: ChapterRequest): Promise<Buffer> {
  return Buffer.from(await engine.generateChapter(req))
}

export async function generateFullBookPdf(req: BookRequest): Promise<Buffer> {
  return Buffer.from(await engine.generateBook(req))
}