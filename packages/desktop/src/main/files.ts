import { app, BrowserWindow, dialog, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { copyFile, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { IPC, type OpenedFile, type ReopenLastResult, type SaveResult } from '@mtc/shared'
import { message, writeAtomic } from './fsUtil.js'
import { LastBookStore } from './lastBook.js'

const MAX_BYTES = 500 * 1024 * 1024
const EXT = '.mtcbook'
const FILTERS = [{ name: 'Libro MTC Books', extensions: ['mtcbook'] }]

interface Deps {
  getWindow: () => BrowserWindow | null
  allowedOrigin: string
}

/** Impronta del file all'ultima lettura o scrittura: serve a scoprire modifiche fatte da altri programmi */
interface Stamp { mtimeMs: number; size: number }

let deps: Deps
let currentPath: string | null = null     // file su cui scrive il salvataggio
let currentStamp: Stamp | null = null
let candidatePath: string | null = null   // file appena letto: diventa corrente solo se l'app lo carica davvero
let candidateStamp: Stamp | null = null
let pending: OpenedFile | null = null     // file aperto dal sistema prima che la pagina fosse pronta
let rendererReady = false
let externalOpens = 0                     // aperture dal sistema ancora in lettura
let lastBook: LastBookStore
const backedUp = new Set<string>()        // file di cui in questa sessione esiste già la copia .bak

// Si usa l'origine del frame: new URL('app://mtc/').origin vale "null" per gli schemi personalizzati
export const isTrusted = (e: IpcMainEvent | IpcMainInvokeEvent): boolean =>
  e.senderFrame?.origin === deps.allowedOrigin


const stampOf = async (file: string): Promise<Stamp | null> => {
  try {
    const s = await stat(file)
    return { mtimeMs: s.mtimeMs, size: s.size }
  } catch {
    return null
  }
}
const sameStamp = (a: Stamp, b: Stamp) => a.mtimeMs === b.mtimeMs && a.size === b.size

const cleanName = (name: string): string => {
  const base = path.basename(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'libro'
  return base.toLowerCase().endsWith(EXT) ? base : base + EXT
}

const box = (win: BrowserWindow | null, options: Electron.MessageBoxOptions) =>
  win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)

async function readBook(filePath: string): Promise<OpenedFile> {
  if (path.extname(filePath).toLowerCase() !== EXT) throw new Error('Il file non è un .mtcbook.')
  const info = await stat(filePath)
  if (info.size > MAX_BYTES) throw new Error('Il file è troppo grande.')
  const buffer = await readFile(filePath)
  candidatePath = filePath
  candidateStamp = { mtimeMs: info.mtimeMs, size: info.size }
  return { name: path.basename(filePath), data: new Uint8Array(buffer) }
}

/** File aperto dal sistema (doppio clic, argomento di avvio, seconda istanza) */
export async function openPath(filePath: string) {
  externalOpens++
  try {
    const file = await readBook(filePath)
    const win = deps.getWindow()
    if (rendererReady && win) {
      if (win.isMinimized()) win.restore()
      win.focus()
      win.webContents.send(IPC.filesExternalOpen, file)
    } else {
      pending = file
    }
  } catch (e) {
    dialog.showErrorBox('Impossibile aprire il file', message(e))
  } finally {
    externalOpens--
  }
}

export const resetRendererReady = () => { rendererReady = false }

export function registerFileIpc(d: Deps) {
  deps = d
  lastBook = new LastBookStore(path.join(app.getPath('userData'), 'last-book.json'))

  ipcMain.handle(IPC.filesOpen, async (event) => {
    if (!isTrusted(event)) return null
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = { title: 'Apri libro', properties: ['openFile' as const], filters: FILTERS }
    const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (res.canceled || !res.filePaths[0]) return null
    try {
      return await readBook(res.filePaths[0])
    } catch (e) {
      dialog.showErrorBox('Impossibile aprire il file', message(e))
      return null
    }
  })

  ipcMain.handle(IPC.filesSave, async (event, data: unknown, suggestedName: unknown, mode: unknown): Promise<SaveResult> => {
    if (!isTrusted(event) || !(data instanceof Uint8Array) || typeof suggestedName !== 'string' ||
      data.byteLength > MAX_BYTES || (mode !== 'save' && mode !== 'auto' && mode !== 'save-as')) {
      return { status: 'error', message: 'Richiesta non valida.' }
    }
    const win = BrowserWindow.fromWebContents(event.sender)

    let target = currentPath
    let askWhere = mode === 'save-as' || !target
    if (mode === 'auto' && !target) return { status: 'no-file' }

    // Il file è stato modificato da altri dopo l'ultima lettura o scrittura di MTC Books?
    if (target && currentStamp && mode !== 'save-as') {
      const now = await stampOf(target)
      if (now && !sameStamp(now, currentStamp)) {
        if (mode === 'auto') return { status: 'conflict' }
        const { response } = await box(win, {
          type: 'warning',
          title: 'File modificato',
          message: `Il file «${path.basename(target)}» è stato modificato da un altro programma dopo l’ultimo salvataggio di MTC Books.`,
          detail: 'Sovrascrivendolo perderai quelle modifiche. In alternativa puoi salvare il libro con un altro nome.',
          buttons: ['Annulla', 'Sovrascrivi', 'Salva con nome…'],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        })
        if (response === 0) return { status: 'cancelled' }
        if (response === 2) askWhere = true
      }
    }

    if (askWhere) {
      const options = {
        title: mode === 'save-as' ? 'Salva con nome' : 'Salva libro',
        defaultPath: target ?? path.join(app.getPath('documents'), cleanName(suggestedName)),
        filters: FILTERS,
      }
      const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
      if (res.canceled || !res.filePath) return { status: 'cancelled' }
      target = res.filePath.toLowerCase().endsWith(EXT) ? res.filePath : res.filePath + EXT
    }
    if (!target) return { status: 'error', message: 'Percorso non disponibile.' }

    try {
      // Una sola copia di sicurezza per sessione: la versione che c'era prima del primo salvataggio
      if (!backedUp.has(target)) {
        await copyFile(target, `${target}.bak`).catch(() => { /* il file non esiste ancora */ })
        backedUp.add(target)
      }
      await writeAtomic(target, data)
      currentPath = target
      currentStamp = await stampOf(target)
      if (currentStamp) await lastBook.remember({ path: target, ...currentStamp })
      app.addRecentDocument(target)
      return { status: 'saved', name: path.basename(target) }
    } catch (e) {
      if (mode !== 'auto') dialog.showErrorBox('Salvataggio non riuscito', message(e))
      return { status: 'error', message: message(e) }
    }
  })

  ipcMain.on(IPC.filesForget, (e) => {
    if (!isTrusted(e)) return
    currentPath = null
    currentStamp = null
    void lastBook.forget()
  })

  ipcMain.on(IPC.filesCommitOpen, (e) => {
    if (!isTrusted(e) || !candidatePath) return
    currentPath = candidatePath
    currentStamp = candidateStamp
    candidatePath = null
    candidateStamp = null
    if (currentStamp) void lastBook.remember({ path: currentPath, ...currentStamp })
    app.addRecentDocument(currentPath)
  })

  // Dopo un riavvio: un file aperto dal sistema ha la precedenza sull'ultimo libro
  ipcMain.handle(IPC.filesReopenLast, async (event): Promise<ReopenLastResult> => {
    if (!isTrusted(event) || pending || externalOpens > 0) return { status: 'none' }
    const last = await lastBook.load()
    if (!last) return { status: 'none' }
    const name = path.basename(last.path)
    const now = await stampOf(last.path)
    if (!now) return { status: 'missing', name }
    try {
      return { status: 'found', file: await readBook(last.path), changed: !sameStamp(now, last) }
    } catch {
      return { status: 'missing', name }
    }
  })

  ipcMain.on(IPC.filesRendererReady, (e) => {
    if (!isTrusted(e)) return
    rendererReady = true
    if (pending) {
      e.sender.send(IPC.filesExternalOpen, pending)
      pending = null
    }
  })
}