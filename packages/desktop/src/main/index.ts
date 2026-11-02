import { app, BrowserWindow, Menu } from 'electron'
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
import { appOrigin, createMainWindow } from './window.js'

app.setName('MTC Book')
registerSchemes()

// Dalla build di Vite (anche non installata): "electron . --dist"
const useDist = app.isPackaged || process.argv.includes('--dist')
const renderIdx = process.argv.indexOf('--render-payload')
const probeIdx = process.argv.indexOf('--engine-probe')
let mainWindow: BrowserWindow | null = null
let engineService: EngineService | null = null
let quitting = false

const findBookArg = (argv: string[]) => argv.find((a) => a.toLowerCase().endsWith('.mtcbook'))

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'editMenu' },
    ...(app.isPackaged ? [] : [{ role: 'viewMenu' as const }]),
    { role: 'windowMenu' },
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
    engineService = await setupEngine(() => mainWindow) // prima della finestra: la pagina lo chiama subito
    mainWindow = createMainWindow(useDist)
    mainWindow.on('closed', () => { mainWindow = null })

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