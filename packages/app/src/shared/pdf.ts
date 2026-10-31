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
}

export interface BookPdfRequest {
  sections: ExportSection[]
  customCss: string
  bookTitle: string
  pageSize?: string
}