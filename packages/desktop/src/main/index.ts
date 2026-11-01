import { app, BrowserWindow, Menu } from 'electron'
import { handleAppProtocol } from './appProtocol.js'
import { registerSchemes } from './schemes.js'
import { registerFileIpc, openPath } from './files.js'
import { registerPdfIpc } from './pdf/ipc.js'
import { runRenderCli } from './cli.js'
import { appOrigin, createMainWindow } from './window.js'

app.setName('MTC Book')
registerSchemes()

// Dalla build di Vite (anche non installata): "electron . --dist"
const useDist = app.isPackaged || process.argv.includes('--dist')
const cliIndex = process.argv.indexOf('--render-payload')
let mainWindow: BrowserWindow | null = null

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

if (cliIndex >= 0) {
  // Modalità di prova: genera un PDF da un payload e termina. Nessuna finestra, nessun blocco di istanza unica.
  const [payload, kind, out] = process.argv.slice(cliIndex + 1)
  // Senza questo gestore Electron esce da solo quando si chiude l'ultima finestra nascosta, a PDF non ancora scritto
  app.on('window-all-closed', () => { })
  const exit = (code: number) => setTimeout(() => app.exit(code), 300) // lascia scaricare stdout
  void app.whenReady()
    .then(() => runRenderCli(payload, kind, out))
    .then(exit, (e) => { console.error(e); exit(1) })
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

  app.whenReady().then(() => {
    console.log(`[PDF] Chromium ${process.versions.chrome}`)
    if (useDist) handleAppProtocol()
    buildMenu()
    registerFileIpc({ getWindow: () => mainWindow, allowedOrigin: appOrigin(useDist) })
    registerPdfIpc()
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