import { app, BrowserWindow, ipcMain, Menu, session, type MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import { IPC, type SpellcheckSnapshot, type SpellcheckStatus } from '@mtc/shared'
import { isTrusted } from './files.js'
import { SpellcheckStore } from './spellcheckStore.js'

const MAX_SUGGESTIONS = 6

/**
 * Electron scarica da solo il dizionario della lingua del sistema, in ogni sessione, anche con il controllo spento.
 * Solo un elenco di lingue vuoto lo impedisce: va impostato appena l'app è pronta, prima di aprire finestre.
 */
export const blockDictionaryDownload = () => session.defaultSession.setSpellCheckerLanguages([])

export async function setupSpellcheck(getWindow: () => BrowserWindow | null) {
  const store = new SpellcheckStore(path.join(app.getPath('userData'), 'spellcheck-settings.json'))
  const ses = session.defaultSession
  let status: SpellcheckStatus = {}

  const publish = (language: string, state: SpellcheckStatus[string]) => {
    status = { ...status, [language]: state }
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(IPC.spellcheckStatus, status)
  }
  ses.on('spellcheck-dictionary-download-begin', (_e, language) => publish(language, 'downloading'))
  ses.on('spellcheck-dictionary-download-success', (_e, language) => publish(language, 'ready'))
  ses.on('spellcheck-dictionary-download-failure', (_e, language) => publish(language, 'failed'))
  ses.on('spellcheck-dictionary-initialized', (_e, language) => publish(language, 'ready'))

  const apply = () => {
    const { enabled, languages } = store.data
    status = {}
    ses.setSpellCheckerEnabled(enabled)
    ses.setSpellCheckerLanguages(enabled ? languages.filter((l) => ses.availableSpellCheckerLanguages.includes(l)) : [])
  }

  const snapshot = (): SpellcheckSnapshot => ({ settings: store.data, status })

  await store.load()
  apply()

  ipcMain.handle(IPC.spellcheckGet, (event) => {
    if (!isTrusted(event)) throw new Error('Richiesta non valida.')
    return snapshot()
  })

  ipcMain.handle(IPC.spellcheckSet, async (event, next: unknown) => {
    if (!isTrusted(event)) throw new Error('Richiesta non valida.')
    await store.save(next)
    apply()
    return snapshot()
  })
}

/** Menu del tasto destro: nell'app non ce n'è uno di serie, nemmeno per Taglia, Copia e Incolla */
export function attachContextMenu(win: BrowserWindow) {
  win.webContents.on('context-menu', (_event, params) => {
    const items: MenuItemConstructorOptions[] = []
    const word = params.misspelledWord

    if (word) {
      for (const suggestion of params.dictionarySuggestions.slice(0, MAX_SUGGESTIONS)) {
        items.push({ label: suggestion, click: () => win.webContents.replaceMisspelling(suggestion) })
      }
      if (!params.dictionarySuggestions.length) items.push({ label: 'Nessun suggerimento', enabled: false })
      items.push(
        { label: `Aggiungi «${word}» al dizionario`, click: () => win.webContents.session.addWordToSpellCheckerDictionary(word) },
        { type: 'separator' },
      )
    }

    if (params.isEditable) {
      items.push(
        { label: 'Taglia', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copia', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Incolla', role: 'paste', enabled: params.editFlags.canPaste },
        { label: 'Seleziona tutto', role: 'selectAll', enabled: params.editFlags.canSelectAll },
      )
    } else if (params.selectionText.trim()) {
      items.push({ label: 'Copia', role: 'copy' })
    }

    if (items.length) Menu.buildFromTemplate(items).popup({ window: win })
  })
}
