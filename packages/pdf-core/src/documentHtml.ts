// Numeri di pagina in basso al centro; nessun numero sulla copertina
export const PAGE_NUMBER_CSS = `
  @page {
    @bottom-center {
      content: counter(page);
      font-family: 'Lora', Georgia, serif;
      font-size: 9pt;
      color: #525252;
    }
  }
  /* Per sicurezza: la pagina con nome "cover" eredita il box, lo azzeriamo */
  @page cover {
    @bottom-center { content: none; }
  }
`

export function buildFullDocumentHtml(sectionsHtml: string, customCss: string, fontCss: string): string {
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <style>
        ${fontCss}
        ${customCss}
        ${PAGE_NUMBER_CSS}
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