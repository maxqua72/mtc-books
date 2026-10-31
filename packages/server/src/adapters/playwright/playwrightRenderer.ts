import { chromium, type Browser, type Page } from 'playwright'
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
  }
}