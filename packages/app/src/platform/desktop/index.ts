import type { Platform } from '../types'
import { webPdf } from '../web/webPdf'
import { desktopFiles } from './desktopFiles'

export function createDesktopPlatform(): Platform {
  return {
    capabilities: {
      cloudPdf: true,     // fase 4a: il PDF passa ancora dal server HTTP; con la 4b diventa localPdf
      localPdf: false,
      nativeFiles: true,
      engine: false,      // fase 5
      multiTabLock: false // istanza unica garantita dal main
    },
    pdf: webPdf,
    files: desktopFiles,
    session: { acquireWriteLock: async () => true },
  }
}