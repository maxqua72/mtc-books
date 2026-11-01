import { chromium, type Browser, type Page } from 'playwright'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PdfPage, PdfRenderer } from '@mtc/pdf-core'

let browserPromise: Promise<Browser> | null = null

/** Un solo Chromium per tutto il processo; richieste concorrenti all'avvio non ne lanciano due */
export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
      .then((browser) => {
        console.log('Motore Chromium per PDF avviato.')
        browser.on('disconnected', () => { browserPromise = null }) // se Chromium cade, alla richiesta successiva riparte
        return browser
      })
      .catch((err) => {
        browserPromise = null
        throw err
      })
  }
  return browserPromise
}

const wrap = (page: Page): PdfPage => ({
  setContent: (html) => page.setContent(html, { waitUntil: 'load' }),
  evaluate: (fn, arg) => page.evaluate(fn as any, arg) as any,
  pdf: (options) => page.pdf(options as any),
})

/** Testo di ogni pagina del PDF (frammenti uniti, senza separatori), in ordine di pagina */
async function extractPageTexts(pdf: Uint8Array): Promise<string[]> {
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdf), verbosity: 0 })
  try {
    const doc = await loadingTask.promise
    const out: string[] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      out.push(content.items.map((item: any) => ('str' in item ? item.str : '')).join(''))
      page.cleanup()
    }
    return out
  } finally {
    await loadingTask.destroy()
  }
}

export function createPlaywrightRenderer(): PdfRenderer {
  return {
    async withPage(job) {
      const browser = await getBrowser()
      const context = await browser.newContext()
      try {
        return await job(wrap(await context.newPage()))
      } finally {
        await context.close() // chiude anche la pagina
      }
    },
    extractPageTexts,
  }
}