import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type DesktopBridge, type OpenedFile, type PdfProgress } from '@mtc/shared'

const bridge: DesktopBridge = {
  platform: process.platform,
  files: {
    open: () => ipcRenderer.invoke(IPC.filesOpen),
    save: (data, suggestedName, mode) => ipcRenderer.invoke(IPC.filesSave, data, suggestedName, mode),
    forget: () => ipcRenderer.send(IPC.filesForget),
    commitOpen: () => ipcRenderer.send(IPC.filesCommitOpen),
    onExternalOpen(cb) {
      const listener = (_event: unknown, file: OpenedFile) => cb(file)
      ipcRenderer.on(IPC.filesExternalOpen, listener)
      ipcRenderer.send(IPC.filesRendererReady) // il main consegna l'eventuale file in attesa
      return () => { ipcRenderer.removeListener(IPC.filesExternalOpen, listener) }
    },
    onBeforeClose(cb) {
      const listener = async () => {
        try { await cb() } finally { ipcRenderer.send(IPC.appFlushDone) }
      }
      ipcRenderer.on(IPC.appFlush, listener)
      ipcRenderer.send(IPC.appFlushReady)
      return () => { ipcRenderer.removeListener(IPC.appFlush, listener) }
    },
  },
  pdf: {
    exportChapter: (req) => ipcRenderer.invoke(IPC.pdfExportChapter, req),
    exportBook: (req) => ipcRenderer.invoke(IPC.pdfExportBook, req),
    cancel: () => ipcRenderer.send(IPC.pdfCancel),
    onProgress(cb) {
      const listener = (_event: unknown, p: PdfProgress) => cb(p)
      ipcRenderer.on(IPC.pdfProgress, listener)
      return () => { ipcRenderer.removeListener(IPC.pdfProgress, listener) }
    },
  },
}

contextBridge.exposeInMainWorld('mtcDesktop', bridge)