import { protocol } from 'electron'
import { APP_SCHEME } from './appProtocol.js'
import { RENDER_SCHEME } from './pdf/renderProtocol.js'

/** Va chiamata una sola volta, prima di app.whenReady() */
export function registerSchemes() {
  const privileges = { standard: true, secure: true, supportFetchAPI: true }
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges },
    { scheme: RENDER_SCHEME, privileges },
  ])
}