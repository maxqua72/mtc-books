import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type DesktopBridge, type OpenedFile } from '@mtc/shared'

const bridge: DesktopBridge = {
  platform: process.platform,
  files: {
    open: () => ipcRenderer.invoke(IPC.filesOpen),
    save: (data, suggestedName) => ipcRenderer.invoke(IPC.filesSave, data, suggestedName),
    forget: () => ipcRenderer.send(IPC.filesForget),
    commitOpen: () => ipcRenderer.send(IPC.filesCommitOpen),
    onExternalOpen(cb) {
      const listener = (_event: unknown, file: OpenedFile) => cb(file)
      ipcRenderer.on(IPC.filesExternalOpen, listener)
      ipcRenderer.send(IPC.filesRendererReady) // il main consegna l'eventuale file in attesa
      return () => { ipcRenderer.removeListener(IPC.filesExternalOpen, listener) }
    },
  },
}

contextBridge.exposeInMainWorld('mtcDesktop', bridge)