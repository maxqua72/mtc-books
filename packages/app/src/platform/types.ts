import type { Ref } from 'vue'
import type { PlatformCapabilities, BookPdfRequest, ChapterPdfRequest } from '@mtc/shared'
import type { EngineBridge } from '@mtc/shared'

export type EnginePlatform = EngineBridge
export interface PdfPlatform {
  exportChapter(req: ChapterPdfRequest): Promise<void>
  exportBook(req: BookPdfRequest): Promise<void>
  /** Solo desktop: testo di avanzamento. Restituisce la funzione per annullare l'iscrizione. */
  onProgress?(cb: (label: string) => void): () => void
  /** Solo desktop: annulla la generazione in corso */
  cancel?(): void
}

export interface PickedBook { data: ArrayBuffer; name: string }

export interface CurrentFile {
  name: string
  /** null = aperto ma non ancora salvato in questa sessione */
  savedAt: number | null
}

export type AutosaveOutcome = 'saved' | 'no-file' | 'conflict' | 'error'

export interface FilesPlatform {
  /** null = l'utente ha annullato */
  pickBook(): Promise<PickedBook | null>
  /** false = annullato o fallito: il libro NON va considerato salvato */
  saveBook(blob: Blob, suggestedName: string): Promise<boolean>

  // --- Solo desktop ---
  forgetCurrentFile?(): void
  /** L'ultimo file scelto è stato caricato: diventa il file su cui salva */
  commitOpen?(name: string): void
  onExternalOpen?(cb: (book: PickedBook) => void): () => void
  saveBookAs?(blob: Blob, suggestedName: string): Promise<boolean>
  /** Salvataggio silenzioso sul file corrente: mai dialoghi */
  autosaveBook?(blob: Blob, suggestedName: string): Promise<AutosaveOutcome>
  /** File associato al libro corrente (null = nessuno) */
  readonly currentFile?: Readonly<Ref<CurrentFile | null>>
  /** La finestra sta per chiudersi: la funzione ha pochi secondi per salvare */
  onBeforeClose?(cb: () => Promise<void>): () => void
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
  readonly engine?: EnginePlatform
}