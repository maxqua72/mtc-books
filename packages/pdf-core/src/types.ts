export interface PdfOptions {
  format?: string
  width?: string
  height?: string
  printBackground: boolean
  margin: { top: string; right: string; bottom: string; left: string }
  displayHeaderFooter: boolean
}

/** Una pagina del browser. Le funzioni passate a evaluate vengono eseguite nel browser: devono essere autosufficienti. */
export interface PdfPage {
  setContent(html: string): Promise<void>
  evaluate<R, A = void>(fn: (arg: A) => R | Promise<R>, arg?: A): Promise<R>
  pdf(options: PdfOptions): Promise<Uint8Array>
}

export interface PdfRenderer {
  /** Apre una pagina isolata, esegue il lavoro e la chiude sempre (anche in caso di errore) */
  withPage<T>(job: (page: PdfPage) => Promise<T>): Promise<T>
  /** Testo di ogni pagina del PDF (frammenti uniti, senza separatori), in ordine di pagina */
  extractPageTexts(pdf: Uint8Array): Promise<string[]>
}