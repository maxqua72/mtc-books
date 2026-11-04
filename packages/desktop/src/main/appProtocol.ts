import { app, net, protocol } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { cspFor } from './csp.js'

export const APP_SCHEME = 'app'
export const APP_ORIGIN = 'app://mtc'


export const rendererDir = (): string =>
  app.isPackaged ? path.join(process.resourcesPath, 'renderer') : path.resolve(__dirname, '../../app/dist')

export function handleAppProtocol() {
  const root = rendererDir()
  protocol.handle(APP_SCHEME, async (request) => {
    let rel = decodeURIComponent(new URL(request.url).pathname)
    if (rel === '/' || rel === '') rel = '/index.html'
    const file = path.resolve(root, '.' + rel)
    if (path.relative(root, file).startsWith('..')) return new Response('Forbidden', { status: 403 })
    try {
      const res = await net.fetch(pathToFileURL(file).toString())
      const headers = new Headers(res.headers)
      // Sul server di sviluppo (http) la CSP è quella di Vite: qui vale solo per l'app servita da app://
      headers.set('Content-Security-Policy', cspFor(rel))
      return new Response(res.body, { status: res.status, headers })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}