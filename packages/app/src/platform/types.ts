import type { PlatformCapabilities, BookPdfRequest, ChapterPdfRequest } from '@mtc/shared'
export interface PdfPlatform {
  exportChapter(req: ChapterPdfRequest): Promise<void>
  exportBook(req: BookPdfRequest): Promise<void>
}

export interface PickedBook { data: ArrayBuffer; name: string }

export interface FilesPlatform {
  /** null = l'utente ha annullato */
  pickBook(): Promise<PickedBook | null>
  /** false = annullato o fallito: il libro NON va considerato salvato */
  saveBook(blob: Blob, suggestedName: string): Promise<boolean>
  /** Solo desktop: il libro corrente non ha più un file associato */
  forgetCurrentFile?(): void
  /** Solo desktop: l'ultimo file scelto è stato caricato, diventa il file su cui salva */
  commitOpen?(): void
  /** Solo desktop: file aperto dal sistema (doppio clic). Restituisce la funzione per annullare l'iscrizione. */
  onExternalOpen?(cb: (book: PickedBook) => void): () => void
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