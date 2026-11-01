import { ref } from 'vue'
import type { OpenedFile, SaveMode, SaveResult } from '@mtc/shared'
import type { AutosaveOutcome, CurrentFile, FilesPlatform, PickedBook } from '../types'

const files = () => window.mtcDesktop!.files

const toArrayBuffer = (u: Uint8Array): ArrayBuffer =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

const toPicked = (f: OpenedFile): PickedBook => ({ data: toArrayBuffer(f.data), name: f.name })

// Il file associato al libro corrente: lo aggiorna questo adattatore, la UI lo legge
const currentFile = ref<CurrentFile | null>(null)

async function send(blob: Blob, suggestedName: string, mode: SaveMode): Promise<SaveResult> {
  const result = await files().save(new Uint8Array(await blob.arrayBuffer()), suggestedName, mode)
  if (result.status === 'saved') currentFile.value = { name: result.name, savedAt: Date.now() }
  return result
}

export const desktopFiles: FilesPlatform = {
  async pickBook() {
    const f = await files().open()
    return f ? toPicked(f) : null
  },
  async saveBook(blob, suggestedName) {
    return (await send(blob, suggestedName, 'save')).status === 'saved'
  },
  async saveBookAs(blob, suggestedName) {
    return (await send(blob, suggestedName, 'save-as')).status === 'saved'
  },
  async autosaveBook(blob, suggestedName): Promise<AutosaveOutcome> {
    const { status } = await send(blob, suggestedName, 'auto')
    return status === 'saved' || status === 'no-file' || status === 'conflict' ? status : 'error'
  },
  forgetCurrentFile() {
    currentFile.value = null
    files().forget()
  },
  commitOpen(name) {
    currentFile.value = { name, savedAt: null }
    files().commitOpen()
  },
  onExternalOpen(cb) { return files().onExternalOpen((f) => cb(toPicked(f))) },
  onBeforeClose(cb) { return files().onBeforeClose(cb) },
  currentFile,
}