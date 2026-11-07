import { renderPdf, type RenderHooks } from './render.js'
import type { PdfRenderer } from './types.js'
import type { ExportSection } from '@mtc/shared'

export interface ChapterRequest {
  htmlContent: string
  customCss: string
  chapterNumber?: number
  pageSize?: string
  /** Fronte/retro: numeri di pagina sul lato esterno */
  outerPageNumbers?: boolean
}

export type SectionItem = ExportSection

export interface BookRequest {
  sections: SectionItem[]
  customCss: string
  bookTitle?: string
  pageSize?: string
  /** Fronte/retro: numeri di pagina sul lato esterno */
  outerPageNumbers?: boolean
}

export interface PdfEngineDeps extends RenderHooks {
  renderer: PdfRenderer
  /** Regole @font-face già pronte: il core non sa dove stanno i font (disco, pacchetto, URL locale) */
  getFontCss: () => Promise<string>
}

/**
 * Gruppo di pagine di una sezione: copertina e quarta di copertina non hanno numero; indice e sezioni prima del
 * primo capitolo sono pagine iniziali (numeri romani); dal primo capitolo in poi è il corpo del libro (arabi da 1).
 */
export const matterClass = (sections: Pick<SectionItem, 'type'>[], index: number): string => {
  if (sections[index].type === 'cover' || sections[index].type === 'backcover') return ''
  const firstChapter = sections.findIndex((s) => s.type === 'chapter')
  if (firstChapter === -1 || index < firstChapter) return 'front-matter'
  return index === firstChapter ? 'body-matter body-start' : 'body-matter'
}

export function createPdfEngine(deps: PdfEngineDeps) {
  const render = async (req: Omit<Parameters<typeof renderPdf>[1], 'fontCss'>) =>
    renderPdf(deps.renderer, { ...req, fontCss: await deps.getFontCss() },
  { onDebugHtml: deps.onDebugHtml, onProgress: deps.onProgress })

  return {
    generateChapter({ htmlContent, customCss, chapterNumber = 1, pageSize = 'A4', outerPageNumbers }: ChapterRequest) {
      // Stesso involucro del libro: i contatori dei titoli partono da .book-section e --chapter-index.
      // Un capitolo esportato da solo si numera da 1.
      const sectionsHtml = `
      <section class="book-section body-matter" style="--chapter-index: ${chapterNumber};">
        ${htmlContent}
      </section>
    `
      return render({ sectionsHtml, customCss, pageSize, debugName: 'debug_output.html', outerPageNumbers })
    },

    /** is-structural-page: solo i capitoli numerano titoli e diagrammi. data-section-type: l'indice raccoglie
     *  tutti i titoli dei capitoli e il solo Titolo 1 delle altre sezioni */
    generateBook({ sections, customCss, pageSize = 'A4', outerPageNumbers }: BookRequest) {
      const sectionsHtml = sections
        .map(
          (sec, i) => `
        <section
          class="book-section ${sec.type === 'chapter' ? '' : 'is-structural-page'} ${matterClass(sections, i)}"
          data-section-id="${sec.id}"
          data-section-type="${sec.type}"
          style="--chapter-index: ${sec.chapterNumber || 1};"
        >
          ${sec.html}
        </section>
      `
        )
        .join('\n')
      return render({ sectionsHtml, customCss, pageSize, debugName: 'debug_output_book.html', withToc: true, outerPageNumbers })
    },
  }
}
