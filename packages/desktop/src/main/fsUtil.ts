import { randomUUID } from 'node:crypto'
import { open, rename as fsRename, rm } from 'node:fs/promises'

// Su Windows antivirus, indicizzazione e OneDrive possono tenere aperto il file per un attimo
const BUSY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY'])
const RETRY_DELAYS_MS = [100, 200, 400, 800]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function renameWithRetry(from: string, to: string, rename: typeof fsRename) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await rename(from, to)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? ''
      if (!BUSY_CODES.has(code) || attempt >= RETRY_DELAYS_MS.length) throw e
      await wait(RETRY_DELAYS_MS[attempt])
    }
  }
}

/**
 * Scrittura atomica: file temporaneo nella stessa cartella, dati forzati su disco, poi rinomina.
 * Se qualcosa fallisce il file di destinazione resta intatto e il temporaneo viene rimosso.
 */
export async function writeAtomic(target: string, data: Uint8Array, rename: typeof fsRename = fsRename) {
  const tmp = `${target}.${randomUUID()}.tmp`
  try {
    const file = await open(tmp, 'wx')
    try {
      await file.writeFile(data)
      await file.sync()
    } finally {
      await file.close()
    }
    await renameWithRetry(tmp, target, rename)
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => { /* resta il temporaneo: il file di destinazione è intatto */ })
    throw e
  }
}

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
