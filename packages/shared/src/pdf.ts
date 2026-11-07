export interface ExportSection {
  id: string
  title: string
  type: string
  chapterNumber?: number
  html: string
}

export interface ChapterPdfRequest {
  htmlContent: string
  customCss: string
  title: string
  chapterNumber?: number
  pageSize?: string
  /** Fronte/retro: numeri di pagina sul lato esterno */
  outerPageNumbers?: boolean
}

export interface BookPdfRequest {
  sections: ExportSection[]
  customCss: string
  bookTitle: string
  pageSize?: string
  /** Fronte/retro: numeri di pagina sul lato esterno */
  outerPageNumbers?: boolean
}
