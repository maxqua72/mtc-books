import { readFile } from 'node:fs/promises'
import { DEFAULT_SPELLCHECK, cleanSpellcheckSettings, type SpellcheckSettings } from '@mtc/shared'
import { writeAtomic } from './fsUtil.js'

/** Scelte dell'utente, nei dati dell'app: valgono per tutti i libri e non entrano mai nel .mtcbook */
export class SpellcheckStore {
  data: SpellcheckSettings = { ...DEFAULT_SPELLCHECK }
  constructor(private readonly file: string) {}

  async load() {
    try {
      this.data = cleanSpellcheckSettings(JSON.parse(await readFile(this.file, 'utf-8')))
    } catch {
      this.data = cleanSpellcheckSettings(null)
    }
  }

  async save(next: unknown): Promise<SpellcheckSettings> {
    this.data = cleanSpellcheckSettings(next)
    await writeAtomic(this.file, new TextEncoder().encode(JSON.stringify(this.data, null, 2)))
    return this.data
  }
}
