export const IPC = {
  filesOpen: 'files:open',
  filesSave: 'files:save',
  filesForget: 'files:forget',
  filesCommitOpen: 'files:commit-open',
  filesRendererReady: 'files:renderer-ready',
  filesExternalOpen: 'files:external-open',
} as const

export interface OpenedFile {
  name: string
  data: Uint8Array
}

/** Ciò che il preload espone alla pagina come window.mtcDesktop. Il renderer non passa mai percorsi: li tiene il main. */
export interface DesktopBridge {
  platform: string
  files: {
    /** Dialogo nativo di apertura. null = annullato */
    open(): Promise<OpenedFile | null>
    /** Scrive sul file corrente o chiede dove salvare. null = annullato o fallito */
    save(data: Uint8Array, suggestedName: string): Promise<{ name: string } | null>
    /** Il libro corrente non ha più un file associato */
    forget(): void
    /** L'ultimo file letto è stato caricato con successo: diventa il file corrente */
    commitOpen(): void
    /** File aperto dal sistema (doppio clic, seconda istanza). Restituisce la funzione per annullare l'iscrizione. */
    onExternalOpen(cb: (file: OpenedFile) => void): () => void
  }
}