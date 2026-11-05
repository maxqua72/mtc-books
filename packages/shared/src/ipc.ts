import type { BookPdfRequest, ChapterPdfRequest } from './pdf.js'
import type { EngineBridge } from './engine.js'
import type { SpellcheckBridge } from './spellcheck.js'

export const IPC = {
  filesOpen: 'files:open',
  filesSave: 'files:save',
  filesForget: 'files:forget',
  filesCommitOpen: 'files:commit-open',
  filesRendererReady: 'files:renderer-ready',
  filesExternalOpen: 'files:external-open',
  filesReopenLast: 'files:reopen-last',
  pdfExportChapter: 'pdf:export-chapter',
  pdfExportBook: 'pdf:export-book',
  pdfProgress: 'pdf:progress',
  pdfCancel: 'pdf:cancel',
  appFlushReady: 'app:flush-ready',
  appFlush: 'app:flush',
  appFlushDone: 'app:flush-done',
  spellcheckGet: 'spellcheck:get',
  spellcheckSet: 'spellcheck:set',
  spellcheckStatus: 'spellcheck:status',
  engineCall: 'engine:call',
  engineEvent: 'engine:event',
} as const

export interface OpenedFile {
  name: string
  data: Uint8Array
}

export type SaveMode = 'save' | 'auto' | 'save-as'

export type SaveResult =
  | { status: 'saved'; name: string }
  | { status: 'cancelled' }   // dialogo annullato
  | { status: 'no-file' }     // salvataggio automatico senza file associato
  | { status: 'conflict' }    // salvataggio automatico: il file è cambiato per mano di altri
  | { status: 'error'; message: string }

/** Ultimo file associato al libro, cercato dopo un riavvio dell'app */
export type ReopenLastResult =
  | { status: 'none' }
  | { status: 'missing'; name: string }                       // il file non c'è più o non si legge
  | { status: 'found'; file: OpenedFile; changed: boolean }   // changed: modificato da altri dopo l'ultimo salvataggio

export type PdfProgressStage = 'loading' | 'toc' | 'final' | 'saving'
export interface PdfProgress { stage: PdfProgressStage }
export type PdfExportResult = { status: 'saved'; name: string } | { status: 'cancelled' }

/** Ciò che il preload espone alla pagina come window.mtcDesktop. Il renderer non passa mai percorsi: li tiene il main. */
export interface DesktopBridge {
  platform: string
  files: {
    /** Dialogo nativo di apertura. null = annullato */
    open(): Promise<OpenedFile | null>
    /** save: file corrente (o dialogo se manca); auto: mai dialoghi; save-as: chiede sempre dove salvare */
    save(data: Uint8Array, suggestedName: string, mode: SaveMode): Promise<SaveResult>
    /** Il libro corrente non ha più un file associato */
    forget(): void
    /** L'ultimo file letto è stato caricato con successo: diventa il file corrente */
    commitOpen(): void
    /** Rilegge l'ultimo file del libro. Diventa il file corrente solo con commitOpen */
    reopenLast(): Promise<ReopenLastResult>
    /** File aperto dal sistema (doppio clic, argomento di avvio, seconda istanza). Iscriversi dice al main che la pagina è pronta a riceverli: consegna subito quello in attesa */
    onExternalOpen(cb: (file: OpenedFile) => void): () => void
    /** Prima della chiusura della finestra il main attende che questa funzione termini (max 6 secondi) */
    onBeforeClose(cb: () => Promise<void>): () => void
  }
  pdf: {
    exportChapter(req: ChapterPdfRequest): Promise<PdfExportResult>
    exportBook(req: BookPdfRequest): Promise<PdfExportResult>
    cancel(): void
    onProgress(cb: (p: PdfProgress) => void): () => void
  }
  engine: EngineBridge
  spellcheck: SpellcheckBridge
}