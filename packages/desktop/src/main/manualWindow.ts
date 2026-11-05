import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { openExternalSafe } from './externalLinks.js'

let manual: BrowserWindow | null = null

export const isManualUrl = (url: string, origin: string): boolean => url.startsWith(`${origin}/manual/`)

/** Finestra separata: nella principale il manuale sostituirebbe l'editor. Senza preload: non serve alcuna API */
export function openManualWindow(url: string, origin: string) {
  if (manual) {
    if (manual.isMinimized()) manual.restore()
    manual.focus()
    return
  }

  manual = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: 'Manuale di MTC Books',
    icon: app.isPackaged ? undefined : path.resolve(__dirname, '../build/icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  manual.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(`${origin}/`)) {
      event.preventDefault()
      openExternalSafe(target)
    }
  })
  manual.webContents.setWindowOpenHandler(({ url: target }) => {
    openExternalSafe(target)
    return { action: 'deny' }
  })
  manual.on('closed', () => { manual = null })
  void manual.loadURL(url)
}

export const closeManualWindow = () => manual?.destroy()
