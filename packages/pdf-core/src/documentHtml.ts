// Numeri di pagina. Pagine iniziali (indice e sezioni prima del primo capitolo) in numeri romani da i,
// corpo del libro (dal primo capitolo) in numeri arabi da 1; copertina senza numero.
// Chromium non azzera in modo stabile il contatore «page»: ogni gruppo ha un contatore proprio,
// incrementato dalla sua pagina con nome.
const NUMBER_STYLE = "font-family: 'Lora', Georgia, serif; font-size: 9pt; color: #525252;"

export interface PageNumberOptions {
  /** Fronte/retro: numero sul lato esterno (a destra nelle pagine dispari, a sinistra nelle pari) */
  outer?: boolean
}

export function pageNumberCss({ outer = false }: PageNumberOptions = {}): string {
  const boxes = (page: string, content: string) => outer
    ? `@page ${page}:right { @bottom-right { content: ${content}; ${NUMBER_STYLE} } }
       @page ${page}:left { @bottom-left { content: ${content}; ${NUMBER_STYLE} } }`
    : `@page ${page} { @bottom-center { content: ${content}; ${NUMBER_STYLE} } }`
  // Fronte/retro: la pagina 1 è una pagina di destra, come nei libri stampati. Chromium ignora break-before: right,
  // quindi render.ts inserisce, se serve, una pagina bianca senza numero (.blank-page) prima del corpo.
  return `
  .blank-page { page: blank; height: 1px; }
  .front-matter { page: front; }
  .body-matter { page: body; }
  @page front { counter-increment: prelim; }
  @page body { counter-increment: corpo; }
  ${boxes('front', 'counter(prelim, lower-roman)')}
  ${boxes('body', 'counter(corpo)')}
`
}

export function buildFullDocumentHtml(sectionsHtml: string, customCss: string, fontCss: string, numbers: PageNumberOptions = {}): string {
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <style>
        ${fontCss}
        ${customCss}
        ${pageNumberCss(numbers)}
      </style>
    </head>
    <body>
      <div class="book-print-container book-text-engine show-numbering">
        ${sectionsHtml}
      </div>
    </body>
    </html>
  `
}
