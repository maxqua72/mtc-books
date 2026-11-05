import { app, BrowserWindow, dialog, Menu, shell } from 'electron'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { handleAppProtocol } from './appProtocol.js'
import { registerSchemes } from './schemes.js'
import { registerFileIpc, openPath } from './files.js'
import { registerPdfIpc } from './pdf/ipc.js'
import { runEngineProbe, runRenderCli } from './cli.js'
import { setupEngine } from './engine/ipc.js'
import type { EngineService } from './engine/service.js'
import { openManualWindow } from './manualWindow.js'
import { appOrigin, createMainWindow } from './window.js'
import { DOWNLOAD_URL } from '@mtc/shared'
import { setupUpdater, type Updater } from './updater.js'
import { blockDictionaryDownload, setupSpellcheck } from './spellcheck.js'

app.setName('MTC Books')
registerSchemes()
void app.whenReady().then(blockDictionaryDownload) // per primo, in ogni modalità di avvio

// Dalla build di Vite (anche non installata): "electron . --dist"
const useDist = app.isPackaged || process.argv.includes('--dist')
const renderIdx = process.argv.indexOf('--render-payload')
const probeIdx = process.argv.indexOf('--engine-probe')
let mainWindow: BrowserWindow | null = null
let engineService: EngineService | null = null
let quitting = false
let updater: Updater | null = null

const findBookArg = (argv: string[]) => argv.find((a) => a.toLowerCase().endsWith('.mtcbook'))

function showAbout() {
    void dialog.showMessageBox({
        type: 'info',
        title: 'MTC Books',
        message: `MTC Books ${app.getVersion()}`,
        detail: `Electron ${process.versions.electron}\nChromium ${process.versions.chrome}\nNode ${process.versions.node}\n\nCartella dei dati:\n${app.getPath('userData')}`,
        buttons: ['OK'],
    })
}

function buildMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
        ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
        { role: 'editMenu' },
        ...(app.isPackaged ? [] : [{ role: 'viewMenu' as const }]),
        { role: 'windowMenu' },
        {
            label: 'Aiuto',
            submenu: [
                {
                    label: 'Manuale utente',
                    accelerator: 'F1',
                    click: () => {
                        const origin = appOrigin(useDist)
                        openManualWindow(`${origin}/manual/index.html`, origin)
                    },
                },
                { type: 'separator' },
                { label: 'Verifica aggiornamenti…', click: () => updater?.checkNow() },
                { label: 'Pagina di download e novità', click: () => void shell.openExternal(DOWNLOAD_URL) },
                { label: 'Apri la cartella dei dati', click: () => void shell.openPath(app.getPath('userData')) },
                { type: 'separator' },
                { label: 'Informazioni su MTC Books…', click: showAbout },
            ],
        },
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

if (renderIdx >= 0 || probeIdx >= 0) {
    // Modalità di prova da riga di comando: nessuna finestra, nessun blocco di istanza unica
    const profile = mkdtempSync(path.join(tmpdir(), 'mtc-cli-')) // profilo usa e getta: niente conflitti di cache
    app.setPath('userData', profile)
    app.on('window-all-closed', () => { }) // senza, Electron esce da solo a PDF non ancora scritto
    const exit = (code: number) => setTimeout(() => {
        try { rmSync(profile, { recursive: true, force: true }) } catch { /* in uso: lo ripulisce il sistema */ }
        app.exit(code)
    }, 300) // lascia scaricare stdout
    const task = () => {
        if (renderIdx >= 0) {
            const [payload, kind, out] = process.argv.slice(renderIdx + 1)
            return runRenderCli(payload, kind, out)
        }
        return runEngineProbe(process.argv[probeIdx + 1], process.argv[probeIdx + 2])
    }
    void app.whenReady().then(task).then(exit, (e) => { console.error(e); exit(1) })
} else if (!app.requestSingleInstanceLock()) {
    app.quit()
} else {
    app.on('second-instance', (_event, argv) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
        const file = findBookArg(argv)
        if (file) void openPath(file)
    })

    app.on('open-file', (event, filePath) => { // macOS
        event.preventDefault()
        void openPath(filePath)
    })

    // Il motore va chiuso con garbo prima di uscire: nessun processo orfano
    app.on('before-quit', (event) => {
        if (!engineService || quitting) return
        event.preventDefault()
        quitting = true
        void engineService.shutdown().finally(() => app.quit())
    })
    app.on('will-quit', () => engineService?.killNow())

    app.whenReady().then(async () => {
        console.log(`[PDF] Chromium ${process.versions.chrome}`)
        if (useDist) handleAppProtocol()
        buildMenu()
        registerFileIpc({ getWindow: () => mainWindow, allowedOrigin: appOrigin(useDist) })
        registerPdfIpc()
        await setupSpellcheck(() => mainWindow)
        engineService = await setupEngine(() => mainWindow) // prima della finestra: la pagina lo chiama subito
        mainWindow = createMainWindow(useDist)
        mainWindow.on('closed', () => { mainWindow = null })

        updater = setupUpdater(() => mainWindow, async () => { await engineService?.shutdown() })

        const file = findBookArg(process.argv.slice(1))
        if (file) void openPath(file)

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow(useDist)
        })
    })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit()
    })
}