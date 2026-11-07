import { buildFullDocumentHtml } from './documentHtml.js'
import { pdfPageOptions } from './pageFormats.js'
import { fillTocPages, findHeadingPages, pageLabeler, prepareToc } from './toc.js'
import type { PdfOptions, PdfRenderer } from './types.js'

export type PdfStage = 'loading' | 'toc' | 'final'

export interface RenderRequest {
  sectionsHtml: string
  customCss: string
  fontCss: string
  pageSize: string
  debugName: string
  /** Libro intero: prima passata per scoprire in che pagina cade ogni titolo, poi si scrivono i numeri nell'indice */
  withToc?: boolean
  /** Fronte/retro: numeri di pagina sul lato esterno */
  outerPageNumbers?: boolean
}

export interface RenderHooks {
  /** Per ispezionare l'HTML inviato a Chromium (il core non scrive su disco) */
  onDebugHtml?: (name: string, html: string) => Promise<void>
  onProgress?: (stage: PdfStage) => void
}

/** Unico percorso di rendering, usato dal capitolo singolo e dal libro intero */
export async function renderPdf(renderer: PdfRenderer, req: RenderRequest, hooks: RenderHooks = {}): Promise<Uint8Array> {
  const fullHtml = buildFullDocumentHtml(req.sectionsHtml, req.customCss, req.fontCss, { outer: req.outerPageNumbers })
  await hooks.onDebugHtml?.(req.debugName, fullHtml)

  return renderer.withPage(async (page) => {
    hooks.onProgress?.('loading')
    await page.setContent(fullHtml)

    await page.evaluate(async () => {
      await document.fonts.ready
      // Le immagini (es. la copertina) devono essere decodificate prima di stampare; una rotta non blocca l'esportazione
      await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => { })))
    })

    const pdfOptions: PdfOptions = {
      ...pdfPageOptions(req.pageSize),
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }, // i margini veri vengono da @page nel CSS del libro
      displayHeaderFooter: false,
    }

    if (req.withToc) {
      const tocEntries = await prepareToc(page)
      if (tocEntries > 0 || req.outerPageNumbers) {
        // Prima passata: in che pagina cadono i titoli e dove comincia il corpo del libro
        hooks.onProgress?.('toc')
        const texts = await renderer.extractPageTexts(await page.pdf(pdfOptions))
        if (tocEntries > 0) {
          const pages = findHeadingPages(texts)
          if (pages.size === 0) console.warn('[PDF ENGINE] Nessun marcatore trovato nel PDF: indice senza numeri.')
          else console.log(`[PDF ENGINE] Indice: trovate ${pages.size} pagine di titoli.`)
          // Nell'indice va il numero stampato sulla pagina (romano o arabo), non la posizione nel PDF.
          // La pagina bianca aggiunta qui sotto non cambia i numeri: il corpo si conta dal suo inizio.
          const label = pageLabeler(texts)
          await fillTocPages(page, new Map([...pages].map(([n, p]) => [n, label(p)])))
        }
        // Fronte/retro: il corpo comincia su una pagina di destra (dispari); se cade a sinistra, prima una pagina bianca
        const bodyStart = texts.findIndex((t) => t.replace(/\s+/g, '').includes('[[BODY]]')) + 1
        if (req.outerPageNumbers && bodyStart > 0 && bodyStart % 2 === 0) {
          await page.evaluate(() => {
            const start = document.querySelector('section.body-start')
            const blank = document.createElement('div')
            blank.className = 'blank-page'
            start?.before(blank)
          })
        }
      }
      // I marcatori servivano solo alla prima passata: via dal DOM, così non finiscono nel PDF finale
      await page.evaluate(() => document.querySelectorAll('.toc-marker').forEach(m => m.remove()))
    }

    hooks.onProgress?.('final')
    return page.pdf(pdfOptions)
  })
}