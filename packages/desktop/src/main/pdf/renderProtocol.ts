import { net, session, type Session } from 'electron'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fontsDir, pdfjsDir } from './assets.js'

export const RENDER_SCHEME = 'mtc-render'
export const RENDER_ORIGIN = 'mtc-render://render'

const docs = new Map<string, string>()
const pdfs = new Map<string, Uint8Array>()

export const putDoc = (html: string) => { const id = randomUUID(); docs.set(id, html); return id }
export const dropDoc = (id: string) => { docs.delete(id) }
export const putPdf = (data: Uint8Array) => { const id = randomUUID(); pdfs.set(id, data); return id }
export const dropPdf = (id: string) => { pdfs.delete(id) }

// Il documento da stampare non può eseguire script né caricare altro che font locali e immagini incorporate
const DOC_CSP = "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src data:"

// Pagina di servizio: legge un PDF con pdfjs e restituisce il testo di ogni pagina
const HELPER_HTML = `<!doctype html><meta charset="utf-8"><script type="module">
import * as pdfjs from '/pdfjs/pdf.mjs'
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs'
window.__extract = async (id) => {
  const data = new Uint8Array(await (await fetch('/pdf/' + id)).arrayBuffer())
  const task = pdfjs.getDocument({ data, verbosity: 0 })
  try {
    const doc = await task.promise
    const out = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      out.push(content.items.map((i) => ('str' in i ? i.str : '')).join(''))
      page.cleanup()
    }
    return out
  } finally {
    await task.destroy()
  }
}
window.__ready = true
</script>`

const PDFJS_FILES = new Set(['pdf.mjs', 'pdf.worker.mjs'])
const notFound = () => new Response('Not found', { status: 404 })

async function fromDir(dir: string, name: string, contentType?: string): Promise<Response> {
  const file = path.resolve(dir, path.basename(name))
  try {
    const res = await net.fetch(pathToFileURL(file).toString())
    if (!contentType) return res
    const headers = new Headers(res.headers)
    headers.set('content-type', contentType)
    return new Response(res.body, { status: res.status, headers })
  } catch {
    return notFound()
  }
}

async function handle(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (pathname === '/pdfjs-helper.html') {
    return new Response(HELPER_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
  const [, kind, ...rest] = pathname.split('/')
  const name = decodeURIComponent(rest.join('/'))

  if (kind === 'doc') {
    const html = docs.get(name)
    return html === undefined ? notFound() : new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': DOC_CSP },
    })
  }
  if (kind === 'pdf') {
    const data = pdfs.get(name)
    return data ? new Response(data as BufferSource, { headers: { 'content-type': 'application/pdf' } }) : notFound()
  }
  if (kind === 'fonts') return fromDir(fontsDir(), name)
  if (kind === 'pdfjs' && PDFJS_FILES.has(name)) return fromDir(pdfjsDir(), name, 'text/javascript')
  return notFound()
}

let renderSession: Session | null = null

/** Sessione dedicata alle finestre nascoste: senza dati su disco e senza rete */
export function getRenderSession(): Session {
  if (renderSession) return renderSession
  const ses = session.fromPartition('mtc-render') // senza "persist:" resta in memoria
  ses.setSpellCheckerLanguages([])                // nessun dizionario: altrimenti Electron lo scarica da solo
  ses.webRequest.onBeforeRequest((details, callback) => {
    const ok = details.url.startsWith(`${RENDER_ORIGIN}/`) || details.url.startsWith('data:') || details.url.startsWith('blob:')
    callback({ cancel: !ok })
  })
  ses.protocol.handle(RENDER_SCHEME, handle)
  renderSession = ses
  return ses
}