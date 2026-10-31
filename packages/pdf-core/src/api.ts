import { renderPdf, type RenderHooks } from './render.js'
import type { PdfRenderer } from './types.js'
import type { ExportSection } from '@mtc/shared'

export interface ChapterRequest {
  htmlContent: string
  customCss: string
  chapterNumber?: number
  pageSize?: string
}

export type SectionItem = ExportSection

export interface BookRequest {
  sections: SectionItem[]
  customCss: string
  bookTitle?: string
  pageSize?: string
}

export interface PdfEngineDeps extends RenderHooks {
  renderer: PdfRenderer
  /** Regole @font-face già pronte: il core non sa dove stanno i font (disco, pacchetto, URL locale) */
  getFontCss: () => Promise<string>
}

export function createPdfEngine(deps: PdfEngineDeps) {
  const render = async (req: Omit<Parameters<typeof renderPdf>[1], 'fontCss'>) =>
    renderPdf(deps.renderer, { ...req, fontCss: await deps.getFontCss() }, { onDebugHtml: deps.onDebugHtml })

  return {
    /** PDF di un singolo capitolo */
    generateChapter({ htmlContent, customCss, chapterNumber = 1, pageSize = 'A4' }: ChapterRequest) {
      // Avvolge anche il singolo capitolo in <section class="book-section">
      const sectionsHtml = `
      <section class="book-section" style="--chapter-index: ${chapterNumber};">
        ${htmlContent}
      </section>
    `
      return render({ sectionsHtml, customCss, pageSize, debugName: 'debug_output.html' })
    },

    /** PDF dell'intero libro: ogni sezione in un <section class="book-section">, con indice numerato */
    generateBook({ sections, customCss, pageSize = 'A4' }: BookRequest) {
      const sectionsHtml = sections
        .map(
          (sec) => `
        <section 
          class="book-section ${sec.type === 'cover' || sec.type === 'index' ? 'is-structural-page' : ''}" 
          data-section-id="${sec.id}" 
          data-section-type="${sec.type}" 
          style="--chapter-index: ${sec.chapterNumber || 1};"
        >
          ${sec.html}
        </section>
      `
        )
        .join('\n')
      return render({ sectionsHtml, customCss, pageSize, debugName: 'debug_output_book.html', withToc: true })
    },
  }
}