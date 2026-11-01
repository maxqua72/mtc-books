import { BrowserWindow } from 'electron'
import type { PdfOptions, PdfPage, PdfRenderer } from '@mtc/pdf-core'
import { RENDER_ORIGIN, dropDoc, dropPdf, getRenderSession, putDoc, putPdf } from './renderProtocol.js'

type PageName = Extract<NonNullable<Electron.PrintToPDFOptions['pageSize']>, string>

const NAMED: Record<string, PageName> = {
  a3: 'A3', a4: 'A4', a5: 'A5', letter: 'Letter', legal: 'Legal', tabloid: 'Tabloid', ledger: 'Ledger',
}

const mmToInches = (value: string): number => {
  const m = /^([\d.]+)mm$/.exec(value)
  if (!m) throw new Error(`Misura non supportata: ${value}`)
  return Number(m[1]) / 25.4
}

function toElectronOptions(o: PdfOptions): Electron.PrintToPDFOptions {
  let pageSize: Electron.PrintToPDFOptions['pageSize']
  if (o.width && o.height) {
    pageSize = { width: mmToInches(o.width), height: mmToInches(o.height) }
  } else {
    pageSize = NAMED[(o.format ?? 'a4').toLowerCase()]
    if (!pageSize) throw new Error(`Formato pagina non supportato: ${o.format}`)
  }
  return {
    pageSize,
    printBackground: o.printBackground,
    displayHeaderFooter: o.displayHeaderFooter,
    preferCSSPageSize: false, // come in Playwright: la misura viene dalle opzioni, i margini dal CSS @page
    margins: {
      top: mmToInches(o.margin.top),
      bottom: mmToInches(o.margin.bottom),
      left: mmToInches(o.margin.left),
      right: mmToInches(o.margin.right),
    },
  }
}

export class PdfCancelled extends Error {
  constructor() { super('Esportazione annullata.') }
}

const active = new Set<BrowserWindow>()
let cancelled = false

export const beginExport = () => { cancelled = false }

export function cancelActiveExports() {
  cancelled = true
  for (const win of active) if (!win.isDestroyed()) win.destroy()
}

function newWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: {
      session: getRenderSession(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })
  active.add(win)
  win.on('closed', () => active.delete(win))
  return win
}

function wrap(win: BrowserWindow): PdfPage {
  const wc = win.webContents
  return {
    async setContent(html) {
      const id = putDoc(html)
      try {
        await wc.loadURL(`${RENDER_ORIGIN}/doc/${id}`)
        const broken = await wc.executeJavaScript(
          `document.fonts.ready.then(() => Array.from(document.fonts).filter(f => f.status === 'error').map(f => f.family))`
        ) as string[]
        if (broken.length) console.warn('[PDF] Font non caricati:', [...new Set(broken)].join(', '))
      } finally {
        dropDoc(id) // la pagina è già caricata
      }
    },
    // La funzione viaggia come testo ed è eseguita nella pagina: deve restare autosufficiente (vincolo del core)
    evaluate: ((fn: (arg: unknown) => unknown, arg?: unknown) =>
      wc.executeJavaScript(`(${fn.toString()})(${JSON.stringify(arg)})`)) as unknown as PdfPage['evaluate'],
    async pdf(options) {
      return wc.printToPDF(toElectronOptions(options))
    },
  }
}

export function createElectronRenderer(): PdfRenderer {
  return {
    async withPage(job) {
      const win = newWindow()
      try {
        return await job(wrap(win))
      } catch (e) {
        if (cancelled) throw new PdfCancelled()
        throw e
      } finally {
        if (!win.isDestroyed()) win.destroy()
      }
    },

    async extractPageTexts(pdf) {
      const id = putPdf(pdf)
      const win = newWindow()
      try {
        await win.webContents.loadURL(`${RENDER_ORIGIN}/pdfjs-helper.html`)
        await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
          const start = Date.now()
          const check = () => window.__ready ? resolve(true)
            : Date.now() - start > 15000 ? reject(new Error('pdfjs non caricato'))
            : setTimeout(check, 20)
          check()
        })`)
        return await win.webContents.executeJavaScript(`window.__extract(${JSON.stringify(id)})`) as string[]
      } catch (e) {
        if (cancelled) throw new PdfCancelled()
        throw e
      } finally {
        dropPdf(id)
        if (!win.isDestroyed()) win.destroy()
      }
    },
  }
}