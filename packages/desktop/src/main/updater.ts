import { app, BrowserWindow, dialog } from 'electron'
import { appendFile } from 'node:fs/promises'
import path from 'node:path'
import { autoUpdater, type UpdateInfo } from 'electron-updater'

const FIRST_CHECK_MS = 15_000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

export interface Updater { checkNow(): void }

const logPath = () => path.join(app.getPath('userData'), 'updater.log')
const log = (level: string, message: unknown) => {
  const text = message instanceof Error ? (message.stack ?? message.message) : String(message)
  void appendFile(logPath(), `${new Date().toISOString()} [${level}] ${text}\n`).catch(() => { /* il log non è essenziale */ })
}

/** Aggiornamenti automatici da GitHub Releases. Nell'app non installata sono disattivati. */
export function setupUpdater(getWindow: () => BrowserWindow | null, beforeInstall: () => Promise<void>): Updater {
  const box = (options: Electron.MessageBoxOptions) => {
    const win = getWindow()
    return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
  }

  if (!app.isPackaged) {
    return {
      checkNow() {
        void box({ type: 'info', title: 'MTC Book', message: 'Gli aggiornamenti funzionano solo nell\'applicazione installata.', buttons: ['OK'] })
      },
    }
  }

  autoUpdater.logger = {
    info: (m: unknown) => log('info', m),
    warn: (m: unknown) => log('warn', m),
    error: (m: unknown) => log('error', m),
    debug: (m: unknown) => log('debug', m),
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true // con «Più tardi» si installa alla prossima chiusura
  autoUpdater.allowPrerelease = false

  let manual = false
  let checking = false
  let downloadedVersion: string | null = null

  async function askRestart(version: string) {
    const { response } = await box({
      type: 'question',
      title: 'Aggiornamento pronto',
      message: `La versione ${version} è stata scaricata.`,
      detail: 'Riavvia per installarla: il libro aperto viene salvato prima. Con «Più tardi» l\'aggiornamento si installa alla prossima chiusura dell\'app.',
      buttons: ['Riavvia e aggiorna', 'Più tardi'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })
    if (response !== 0) return
    await beforeInstall()
    autoUpdater.quitAndInstall(true, true)
  }

  autoUpdater.on('checking-for-update', () => { checking = true })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    if (manual) {
      void box({ type: 'info', title: 'Aggiornamento disponibile', message: `È disponibile la versione ${info.version}.`, detail: 'Il download è in corso in background: ti avviserò al termine.', buttons: ['OK'] })
    }
  })

  autoUpdater.on('update-not-available', () => {
    checking = false
    if (manual) void box({ type: 'info', title: 'MTC Book', message: `Hai già l'ultima versione (${app.getVersion()}).`, buttons: ['OK'] })
    manual = false
  })

  autoUpdater.on('error', (error: Error) => {
    checking = false
    log('error', error)
    if (manual) {
      void box({ type: 'error', title: 'Aggiornamenti', message: 'Impossibile verificare gli aggiornamenti.', detail: `${error.message}\n\nControlla la connessione e riprova più tardi.`, buttons: ['OK'] })
    }
    manual = false
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    checking = false
    manual = false
    downloadedVersion = info.version
    void askRestart(info.version)
  })

  const silentCheck = () => {
    if (checking || downloadedVersion) return
    manual = false
    autoUpdater.checkForUpdates().catch((e) => log('error', e))
  }

  setTimeout(silentCheck, FIRST_CHECK_MS)
  setInterval(silentCheck, CHECK_EVERY_MS).unref()

  return {
    checkNow() {
      if (downloadedVersion) { void askRestart(downloadedVersion); return }
      if (checking) {
        void box({ type: 'info', title: 'MTC Book', message: 'La verifica degli aggiornamenti è già in corso.', buttons: ['OK'] })
        return
      }
      manual = true
      autoUpdater.checkForUpdates().catch((e) => log('error', e))
    },
  }
}