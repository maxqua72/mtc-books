import type { Platform } from '../types'
import { webPdf } from './webPdf'
import { webFiles } from './webFiles'
import { webSession } from './webSession'

export function createWebPlatform(): Platform {
  return {
    capabilities: {
      cloudPdf: true,    // oggi il PDF passa dal server: invariato in fase 1
      localPdf: false,
      nativeFiles: false,
      engine: false,
      multiTabLock: 'locks' in navigator
    },
    pdf: webPdf,
    files: webFiles,
    session: webSession
  }
}