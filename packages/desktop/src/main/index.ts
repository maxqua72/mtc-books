import { app, BrowserWindow, Menu } from 'electron'
import { handleAppProtocol, registerAppScheme } from './appProtocol.js'
import { registerFileIpc, openPath } from './files.js'
import { appOrigin, createMainWindow } from './window.js'

app.setName('MTC Book')
registerAppScheme()

// Dalla build di Vite (anche non installata): "electron . --dist"
const useDist = app.isPackaged || process.argv.includes('--dist')
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

if (!app.requestSingleInstanceLock()) {
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
    if (useDist) handleAppProtocol()
    buildMenu()
    registerFileIpc({ getWindow: () => mainWindow, allowedOrigin: appOrigin(useDist) })
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