import type { BookPdfRequest, ChapterPdfRequest } from './pdf.js'

export const IPC = {
  filesOpen: 'files:open',
  filesSave: 'files:save',
  filesForget: 'files:forget',
  filesCommitOpen: 'files:commit-open',
  filesRendererReady: 'files:renderer-ready',
  filesExternalOpen: 'files:external-open',
  pdfExportChapter: 'pdf:export-chapter',
  pdfExportBook: 'pdf:export-book',
  pdfProgress: 'pdf:progress',
  pdfCancel: 'pdf:cancel',
} as const

export interface OpenedFile {
  name: string
  data: Uint8Array
}

export type PdfProgressStage = 'loading' | 'toc' | 'final' | 'saving'
export interface PdfProgress { stage: PdfProgressStage }
export type PdfExportResult = { status: 'saved'; name: string } | { status: 'cancelled' }

export interface DesktopBridge {
  platform: string
  files: {
    open(): Promise<OpenedFile | null>
    save(data: Uint8Array, suggestedName: string): Promise<{ name: string } | null>
    forget(): void
    commitOpen(): void
    onExternalOpen(cb: (file: OpenedFile) => void): () => void
  }
  pdf: {
    /** Chiede dove salvare, genera e scrive il file. 'cancelled' = annullato dall'utente. */
    exportChapter(req: ChapterPdfRequest): Promise<PdfExportResult>
    exportBook(req: BookPdfRequest): Promise<PdfExportResult>
    cancel(): void
    onProgress(cb: (p: PdfProgress) => void): () => void
  }
}