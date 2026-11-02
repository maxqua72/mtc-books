import type { Platform } from '../types'
//import { webPdf } from './webPdf'
import { webFiles } from './webFiles'
import { webSession } from './webSession'
import { webPdfNotice } from './webPdfNotice'

/*
Quando riattiverai il PDF cloud basta rimettere webPdf e cloudPdf: true
*/
export function createWebPlatform(): Platform {
  return {
    capabilities: {
      cloudPdf: false,    
      localPdf: false,
      nativeFiles: false,
      engine: false,
      multiTabLock: 'locks' in navigator
    },
    pdf: webPdfNotice,
    files: webFiles,
    session: webSession
  }
}