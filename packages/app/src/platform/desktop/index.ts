import type { Platform } from '../types'
import { desktopFiles } from './desktopFiles'
import { desktopPdf } from './desktopPdf'

export function createDesktopPlatform(): Platform {
  return {
    capabilities: {
      cloudPdf: false,
      localPdf: true,
      nativeFiles: true,
      engine: true,      // fase 5
      multiTabLock: false, // istanza unica garantita dal main
      spellcheckLanguages: true
    },
    pdf: desktopPdf,
    files: desktopFiles,
    engine: window.mtcDesktop!.engine,
    session: { acquireWriteLock: async () => true },
    spellcheck: {
      load: () => window.mtcDesktop!.spellcheck.get(),
      // Copia semplice: l'IPC non può clonare gli oggetti reattivi di Vue
      save: ({ enabled, languages }) => window.mtcDesktop!.spellcheck.set({ enabled, languages: [...languages] }),
      onStatus: (cb) => window.mtcDesktop!.spellcheck.onStatus(cb),
    },
  }
}