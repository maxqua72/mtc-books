import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type DesktopBridge, type OpenedFile, type PdfProgress, type EngineEvent } from '@mtc/shared'

const call = (method: string, ...args: unknown[]) => ipcRenderer.invoke(IPC.engineCall, method, args)

const bridge: DesktopBridge = {
    platform: process.platform,
    files: {
        open: () => ipcRenderer.invoke(IPC.filesOpen),
        save: (data, suggestedName, mode) => ipcRenderer.invoke(IPC.filesSave, data, suggestedName, mode),
        forget: () => ipcRenderer.send(IPC.filesForget),
        commitOpen: () => ipcRenderer.send(IPC.filesCommitOpen),
        reopenLast: () => ipcRenderer.invoke(IPC.filesReopenLast),
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
    engine: {
        snapshot: () => call('snapshot'),
        detect: () => call('detect'),
        addProfile: (args) => call('addProfile', args ?? []),
        addDetected: (token, args) => call('addDetected', token, args ?? []),
        updateProfile: (id, patch) => call('updateProfile', id, patch),
        removeProfile: (id) => call('removeProfile', id),
        setActiveProfile: (id) => call('setActiveProfile', id),
        enable: () => call('enable'),
        disable: () => call('disable'),
        setOption: (name, value) => call('setOption', name, value),
        pressButton: (name) => call('pressButton', name),
        resetOptions: () => call('resetOptions'),
        setPrefs: (patch) => call('setPrefs', patch),
        analyze: (req) => call('analyze', req),
        stopAnalysis: () => call('stopAnalysis'),
        onEvent(cb) {
            const listener = (_event: unknown, e: EngineEvent) => cb(e)
            ipcRenderer.on(IPC.engineEvent, listener)
            return () => { ipcRenderer.removeListener(IPC.engineEvent, listener) }
        },
    },
}

contextBridge.exposeInMainWorld('mtcDesktop', bridge)