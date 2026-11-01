import { readdir } from 'node:fs/promises'
import { buildFontCss, createPdfEngine, type PdfStage } from '@mtc/pdf-core'
import { fontsDir } from './assets.js'
import { createElectronRenderer } from './electronRenderer.js'
import { RENDER_ORIGIN } from './renderProtocol.js'

let fontCss: Promise<string> | null = null

/** Font da file locali, serviti dal protocollo di rendering: niente base64 nell'HTML */
async function loadFontCss(): Promise<string> {
  const entries = await readdir(fontsDir())
  const { css, missing } = await buildFontCss(entries, (file) => `${RENDER_ORIGIN}/fonts/${encodeURIComponent(file)}`)
  if (missing.length) {
    console.error(`[PDF FONTS] Font non trovati in ${fontsDir()}:\n - ${missing.join('\n - ')}`)
    fontCss = null // non si memorizza: rimettendo il file basta la richiesta successiva
  }
  return css
}

const getFontCss = () => (fontCss ??= loadFontCss())

export function createDesktopPdfEngine(onProgress?: (stage: PdfStage) => void) {
  return createPdfEngine({ renderer: createElectronRenderer(), getFontCss, onProgress })
}