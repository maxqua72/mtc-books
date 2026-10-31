import type { SessionPlatform } from '../types'

const LOCK_NAME = 'mtc-book-write'

export const webSession: SessionPlatform = {
  acquireWriteLock(opts = {}) {
    if (!('locks' in navigator)) return Promise.resolve(true)   // browser senza Web Locks: nessun controllo
    return new Promise<boolean>((resolve) => {
      navigator.locks
        .request(LOCK_NAME, opts.steal ? { steal: true } : { ifAvailable: true }, async (lock) => {
          resolve(!!lock)
          if (lock) await new Promise<never>(() => {})   // mai risolta: il lock cade alla chiusura della scheda
        })
        .catch(() => { opts.onLost?.(); resolve(false) })   // AbortError: un'altra scheda ce l'ha tolto
    })
  }
}