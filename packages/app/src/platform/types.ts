import type { PlatformCapabilities, BookPdfRequest, ChapterPdfRequest } from '@mtc/shared'
export interface PdfPlatform {
  exportChapter(req: ChapterPdfRequest): Promise<void>
  exportBook(req: BookPdfRequest): Promise<void>
}

export interface PickedBook { data: ArrayBuffer; name: string }

export interface FilesPlatform {
  /** null = l'utente ha annullato */
  pickBook(): Promise<PickedBook | null>
  saveBook(blob: Blob, suggestedName: string): Promise<void>
}

export interface WriteLockOptions {
  steal?: boolean
  onLost?: () => void
}

export interface SessionPlatform {
  /** true = questa scheda può scrivere */
  acquireWriteLock(opts?: WriteLockOptions): Promise<boolean>
}

export interface Platform {
  readonly capabilities: PlatformCapabilities
  readonly pdf: PdfPlatform
  readonly files: FilesPlatform
  readonly session: SessionPlatform
}