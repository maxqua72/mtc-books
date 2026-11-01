import type { FilesPlatform, PickedBook } from '../types'
import type { OpenedFile } from '@mtc/shared'

const files = () => window.mtcDesktop!.files

const toArrayBuffer = (u: Uint8Array): ArrayBuffer =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

const toPicked = (f: OpenedFile): PickedBook => ({ data: toArrayBuffer(f.data), name: f.name })

export const desktopFiles: FilesPlatform = {
  async pickBook() {
    const f = await files().open()
    return f ? toPicked(f) : null
  },
  async saveBook(blob, suggestedName) {
    const saved = await files().save(new Uint8Array(await blob.arrayBuffer()), suggestedName)
    return saved !== null
  },
  forgetCurrentFile() { files().forget() },
  commitOpen() { files().commitOpen() },
  onExternalOpen(cb) { return files().onExternalOpen((f) => cb(toPicked(f))) },
}