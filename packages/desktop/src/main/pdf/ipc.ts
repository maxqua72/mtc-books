import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { IPC, type PdfExportResult, type PdfProgressStage } from '@mtc/shared'
import { writeAtomic } from '../fsUtil.js'
import { isTrusted } from '../files.js'
import { createDesktopPdfEngine } from './engine.js'
import { PdfCancelled, beginExport, cancelActiveExports } from './electronRenderer.js'
import { parseBook, parseChapter } from './validate.js'

let busy = false

const slug = (title: string) => title.toLowerCase().replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, '_') || 'libro'

async function runExport(event: IpcMainInvokeEvent, kind: 'chapter' | 'book', raw: unknown): Promise<PdfExportResult> {
  if (!isTrusted(event)) throw new Error('Richiesta non valida.')
  if (busy) throw new Error('Un\'esportazione è già in corso.')

  const chapter = kind === 'chapter' ? parseChapter(raw) : null
  const book = kind === 'book' ? parseBook(raw) : null
  if (!chapter && !book) throw new Error('Dati di esportazione non validi.')

  const win = BrowserWindow.fromWebContents(event.sender)
  const base = slug(chapter ? chapter.title : book!.bookTitle)
  const options = {
    title: 'Salva PDF',
    defaultPath: path.join(app.getPath('documents'), kind === 'chapter' ? `${base}.pdf` : `${base}_completo.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  }
  const dlg = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (dlg.canceled || !dlg.filePath) return { status: 'cancelled' }

  busy = true
  beginExport()
  const send = (stage: PdfProgressStage) => event.sender.send(IPC.pdfProgress, { stage })
  try {
    const engine = createDesktopPdfEngine(send)
    const pdf = chapter ? await engine.generateChapter(chapter) : await engine.generateBook(book!)
    send('saving')
    await writeAtomic(dlg.filePath, pdf)
    return { status: 'saved', name: path.basename(dlg.filePath) }
  } catch (e) {
    if (e instanceof PdfCancelled) return { status: 'cancelled' }
    throw e
  } finally {
    busy = false
  }
}

export function registerPdfIpc() {
  ipcMain.handle(IPC.pdfExportChapter, (event, req: unknown) => runExport(event, 'chapter', req))
  ipcMain.handle(IPC.pdfExportBook, (event, req: unknown) => runExport(event, 'book', req))
  ipcMain.on(IPC.pdfCancel, (event) => { if (isTrusted(event)) cancelActiveExports() })
}