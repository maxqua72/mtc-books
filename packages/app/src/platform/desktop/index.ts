import type { Platform } from '../types'
import { desktopFiles } from './desktopFiles'
import { desktopPdf } from './desktopPdf'

export function createDesktopPlatform(): Platform {
  return {
    capabilities: {
      cloudPdf: false,
      localPdf: true,
      nativeFiles: true,
      engine: false,      // fase 5
      multiTabLock: false // istanza unica garantita dal main
    },
    pdf: desktopPdf,
    files: desktopFiles,
    session: { acquireWriteLock: async () => true },
  }
}