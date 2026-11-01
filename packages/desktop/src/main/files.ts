import { app, BrowserWindow, dialog, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { IPC, type OpenedFile } from '@mtc/shared'
import { message, writeAtomic } from './fsUtil.js'

const MAX_BYTES = 500 * 1024 * 1024
const EXT = '.mtcbook'
const FILTERS = [{ name: 'Libro MTC Book', extensions: ['mtcbook'] }]

interface Deps {
  getWindow: () => BrowserWindow | null
  allowedOrigin: string
}

let deps: Deps
let currentPath: string | null = null   // file su cui scrive "Salva Lavoro"
let candidatePath: string | null = null // file appena letto: diventa corrente solo se l'app lo carica davvero
let pending: OpenedFile | null = null   // file aperto dal sistema prima che la pagina fosse pronta
let rendererReady = false

const trusted = (e: IpcMainEvent | IpcMainInvokeEvent): boolean => {
  try {
    return new URL(e.senderFrame?.url ?? '').origin === deps.allowedOrigin
  } catch {
    return false
  }
}

const cleanName = (name: string): string => {
  const base = path.basename(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'libro'
  return base.toLowerCase().endsWith(EXT) ? base : base + EXT
}

async function readBook(filePath: string): Promise<OpenedFile> {
  if (path.extname(filePath).toLowerCase() !== EXT) throw new Error('Il file non è un .mtcbook.')
  if ((await stat(filePath)).size > MAX_BYTES) throw new Error('Il file è troppo grande.')
  const buffer = await readFile(filePath)
  candidatePath = filePath
  return { name: path.basename(filePath), data: new Uint8Array(buffer) }
}



/** File aperto dal sistema (doppio clic, argomento di avvio, seconda istanza) */
export async function openPath(filePath: string) {
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
  }
}

export const resetRendererReady = () => { rendererReady = false }

export function registerFileIpc(d: Deps) {
  deps = d

  ipcMain.handle(IPC.filesOpen, async (event) => {
    if (!trusted(event)) return null
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

  ipcMain.handle(IPC.filesSave, async (event, data: unknown, suggestedName: unknown) => {
    if (!trusted(event) || !(data instanceof Uint8Array) || typeof suggestedName !== 'string') return null
    if (data.byteLength > MAX_BYTES) return null

    let target = currentPath
    if (!target) {
      const win = BrowserWindow.fromWebContents(event.sender)
      const options = {
        title: 'Salva libro',
        defaultPath: path.join(app.getPath('documents'), cleanName(suggestedName)),
        filters: FILTERS,
      }
      const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
      if (res.canceled || !res.filePath) return null
      target = res.filePath.toLowerCase().endsWith(EXT) ? res.filePath : res.filePath + EXT
    }

    try {
      await writeAtomic(target, data)
      currentPath = target
      return { name: path.basename(target) }
    } catch (e) {
      dialog.showErrorBox('Salvataggio non riuscito', message(e))
      return null
    }
  })

  ipcMain.on(IPC.filesForget, (e) => { if (trusted(e)) currentPath = null })

  ipcMain.on(IPC.filesCommitOpen, (e) => {
    if (!trusted(e) || !candidatePath) return
    currentPath = candidatePath
    candidatePath = null
  })

  ipcMain.on(IPC.filesRendererReady, (e) => {
    if (!trusted(e)) return
    rendererReady = true
    if (pending) {
      e.sender.send(IPC.filesExternalOpen, pending)
      pending = null
    }
  })
}

export const isTrusted = trusted