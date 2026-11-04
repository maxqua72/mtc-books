const directives = (scripts: string) => [
  'default-src \'self\'',
  `script-src ${scripts}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ')

const APP_CSP = directives("'self'")
// Il manuale è una build statica di VitePress, che genera script inline; non contiene dati dell'utente
const MANUAL_CSP = directives("'self' 'unsafe-inline'")

export const cspFor = (pathname: string): string =>
  pathname.startsWith('/manual/') ? MANUAL_CSP : APP_CSP
