import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainEvent } from 'electron'
import path from 'node:path'
import { IPC } from '@mtc/shared'
import { APP_ORIGIN } from './appProtocol.js'
import { resetRendererReady } from './files.js'

const DEV_URL = process.env.MTC_DEV_URL || 'http://localhost:5174'
const SAFE_EXTERNAL = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const FLUSH_TIMEOUT_MS = 6000

export const appOrigin = (useDist: boolean) => (useDist ? APP_ORIGIN : new URL(DEV_URL).origin)

const openExternalSafe = (url: string) => {
    try {
        if (SAFE_EXTERNAL.has(new URL(url).protocol)) void shell.openExternal(url)
    } catch { /* URL non valido: ignorata */ }
}

export function createMainWindow(useDist: boolean): BrowserWindow {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1100,
        minHeight: 700,
        show: false,
        backgroundColor: '#fafafa',
        title: 'MTC Book',
        icon: app.isPackaged ? undefined : path.resolve(__dirname, '../build/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: false,
        },
    })

    win.once('ready-to-show', () => win.show())

    const origin = appOrigin(useDist)
    win.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith(`${origin}/`)) {
            event.preventDefault()
            openExternalSafe(url)
        }
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
        openExternalSafe(url)
        return { action: 'deny' }
    })

    // --- Chiusura in due tempi: prima la pagina scrive il file, poi la finestra si chiude ---
    let flushCapable = false // la pagina si è iscritta a onBeforeClose
    let flushing = false
    let flushed = false

    const onFlushReady = (e: IpcMainEvent) => { if (e.sender === win.webContents) flushCapable = true }
    ipcMain.on(IPC.appFlushReady, onFlushReady)
    win.on('closed', () => { ipcMain.removeListener(IPC.appFlushReady, onFlushReady) })

    win.on('close', (event) => {
        if (flushed || !flushCapable) return
        event.preventDefault()
        if (flushing) return
        flushing = true

        const timer = setTimeout(finish, FLUSH_TIMEOUT_MS)
        const onDone = (e: IpcMainEvent) => { if (e.sender === win.webContents) finish() }
        function finish() {
            clearTimeout(timer)
            ipcMain.removeListener(IPC.appFlushDone, onDone)
            flushing = false
            flushed = true
            if (!win.isDestroyed()) win.close()
        }
        ipcMain.on(IPC.appFlushDone, onDone)
        win.webContents.send(IPC.appFlush)
    })

    // La pagina chiede conferma alla chiusura (beforeunload) se il salvataggio interno non è finito
    win.webContents.on('will-prevent-unload', (event) => {
        const choice = dialog.showMessageBoxSync(win, {
            type: 'question',
            buttons: ['Resta', 'Esci'],
            defaultId: 0,
            cancelId: 0,
            title: 'MTC Book',
            message: 'Il salvataggio automatico non è ancora terminato. Uscire comunque?',
        })
        if (choice === 1) event.preventDefault() // ignora il blocco e lascia chiudere
        else flushed = false                      // resta aperta: alla prossima chiusura si salva di nuovo
    })

    win.webContents.on('did-start-loading', () => {
        resetRendererReady()
        flushCapable = false
    })
    win.webContents.on('did-fail-load', (_e, code, description, _url, isMainFrame) => {
        if (isMainFrame && code !== -3) {
            dialog.showErrorBox('Impossibile caricare l\'app', `${description}\nIn sviluppo, avvia prima: pnpm dev:app`)
        }
    })

    void win.loadURL(useDist ? `${APP_ORIGIN}/` : DEV_URL)
    return win
}