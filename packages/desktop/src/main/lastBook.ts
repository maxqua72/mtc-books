import { readFile, rm } from 'node:fs/promises'
import { writeAtomic } from './fsUtil.js'

/** Ultimo file associato al libro: percorso e impronta all'ultima lettura o scrittura di MTC Books */
export interface LastBook { path: string; mtimeMs: number; size: number }

/** Dati utente dell'app, mai nel .mtcbook. Le scritture passano da una coda: dimenticare e ricordare restano in ordine. */
export class LastBookStore {
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private readonly file: string) {}

  private enqueue(job: () => Promise<void>): Promise<void> {
    const run = this.queue.then(job, job).catch((e) => console.error('[last-book]', e))
    this.queue = run
    return run
  }

  async load(): Promise<LastBook | null> {
    await this.queue
    try {
      const r = JSON.parse(await readFile(this.file, 'utf-8')) as Partial<LastBook>
      const valid = typeof r.path === 'string' && !!r.path && Number.isFinite(r.mtimeMs) && Number.isFinite(r.size)
      return valid ? { path: r.path!, mtimeMs: r.mtimeMs!, size: r.size! } : null
    } catch {
      return null
    }
  }

  remember(entry: LastBook): Promise<void> {
    return this.enqueue(() => writeAtomic(this.file, new TextEncoder().encode(JSON.stringify(entry))))
  }

  forget(): Promise<void> {
    return this.enqueue(() => rm(this.file, { force: true }))
  }
}
