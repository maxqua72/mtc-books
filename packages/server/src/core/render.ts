import { buildFullDocumentHtml } from './documentHtml.js'
import { pdfPageOptions } from './pageFormats.js'
import { fillTocPages, prepareToc, readHeadingPages } from './toc.js'
import type { PdfOptions, PdfRenderer } from './types.js'

export interface RenderRequest {
  sectionsHtml: string
  customCss: string
  fontCss: string
  pageSize: string
  debugName: string
  /** Libro intero: prima passata per scoprire in che pagina cade ogni titolo, poi si scrivono i numeri nell'indice */
  withToc?: boolean
}

export interface RenderHooks {
  /** Per ispezionare l'HTML inviato a Chromium (il core non scrive su disco) */
  onDebugHtml?: (name: string, html: string) => Promise<void>
}

/** Unico percorso di rendering, usato dal capitolo singolo e dal libro intero */
export async function renderPdf(renderer: PdfRenderer, req: RenderRequest, hooks: RenderHooks = {}): Promise<Uint8Array> {
  const fullHtml = buildFullDocumentHtml(req.sectionsHtml, req.customCss, req.fontCss)
  await hooks.onDebugHtml?.(req.debugName, fullHtml)

  return renderer.withPage(async (page) => {
    // Il contenuto è autosufficiente (font e immagini sono data URI): basta il caricamento semplice
    await page.setContent(fullHtml)

    await page.evaluate(async () => {
      await document.fonts.ready
      // Le immagini (es. la copertina) devono essere decodificate prima di stampare
      await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => { })))
    })

    const pdfOptions: PdfOptions = {
      ...pdfPageOptions(req.pageSize),
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      displayHeaderFooter: false,
    }

    if (req.withToc) {
      const tocEntries = await prepareToc(page)
      if (tocEntries > 0) {
        const firstPass = await page.pdf(pdfOptions)
        const pages = await readHeadingPages(firstPass)
        if (pages.size === 0) console.warn('[PDF ENGINE] Nessun marcatore trovato nel PDF: indice senza numeri.')
        else console.log(`[PDF ENGINE] Indice: trovate ${pages.size} pagine di titoli.`)
        await fillTocPages(page, pages)
      } else {
        await page.evaluate(() => document.querySelectorAll('.toc-marker').forEach(m => m.remove()))
      }
    }

    return page.pdf(pdfOptions)
  })
}