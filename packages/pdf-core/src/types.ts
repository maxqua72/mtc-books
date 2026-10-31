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

/** Apre una pagina isolata, esegue il lavoro e la chiude sempre (anche in caso di errore) */
export interface PdfRenderer {
  withPage<T>(job: (page: PdfPage) => Promise<T>): Promise<T>
}