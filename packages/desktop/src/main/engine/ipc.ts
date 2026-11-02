import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC, type EngineEvent } from '@mtc/shared'
import { isTrusted } from '../files.js'
import { EngineService } from './service.js'

export async function setupEngine(getWindow: () => BrowserWindow | null): Promise<EngineService> {
  const service = new EngineService({
    userDataDir: app.getPath('userData'),
    emit: (e: EngineEvent) => {
      const win = getWindow()
      if (win && !win.isDestroyed()) win.webContents.send(IPC.engineEvent, e)
    },
    pickExecutable: async () => {
      const win = getWindow()
      const options: Electron.OpenDialogOptions = {
        title: 'Scegli il motore UCI',
        properties: ['openFile'],
        filters: process.platform === 'win32'
          ? [{ name: 'Programmi', extensions: ['exe'] }, { name: 'Tutti i file', extensions: ['*'] }]
          : [],
      }
      const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
      return res.canceled ? null : res.filePaths[0] ?? null
    },
  })
  await service.init()

  ipcMain.handle(IPC.engineCall, async (event, method: unknown, args: unknown) => {
    if (!isTrusted(event) || typeof method !== 'string' || !Array.isArray(args)) {
      return { ok: false, message: 'Richiesta non valida.' }
    }
    return service.call(method, args)
  })
  return service
}