import type { PdfProgress } from '@mtc/shared'
import type { PdfPlatform } from '../types'

const pdf = () => window.mtcDesktop!.pdf

const LABELS: Record<PdfProgress['stage'], string> = {
  loading: 'Caricamento del documento e dei font…',
  toc: 'Passata 1 di 2: calcolo delle pagine dell’indice…',
  final: 'Generazione del PDF…',
  saving: 'Salvataggio del file…',
}

// Gli errori che attraversano l'IPC arrivano con un prefisso tecnico: si toglie
const clean = (e: unknown) =>
  new Error((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''))

export const desktopPdf: PdfPlatform = {
  async exportChapter(req) {
    try { await pdf().exportChapter(req) } catch (e) { throw clean(e) }
  },
  async exportBook(req) {
    try { await pdf().exportBook(req) } catch (e) { throw clean(e) }
  },
  onProgress: (cb) => pdf().onProgress((p) => cb(LABELS[p.stage])),
  cancel: () => pdf().cancel(),
}