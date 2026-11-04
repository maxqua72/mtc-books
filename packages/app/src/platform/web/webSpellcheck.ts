import { DEFAULT_SPELLCHECK, cleanSpellcheckSettings, type SpellcheckSnapshot } from '@mtc/shared'
import type { SpellcheckPlatform } from '../types'

const KEY = 'mtc-spellcheck'

function read(): SpellcheckSnapshot {
  try {
    const raw = localStorage.getItem(KEY)
    return { settings: raw ? cleanSpellcheckSettings(JSON.parse(raw)) : { ...DEFAULT_SPELLCHECK }, status: {} }
  } catch {
    return { settings: { ...DEFAULT_SPELLCHECK }, status: {} }
  }
}

/** Nel browser dizionari e lingue sono del browser: qui si ricorda solo se il controllo è attivo */
export const webSpellcheck: SpellcheckPlatform = {
  load: async () => read(),
  async save(settings) {
    const clean = cleanSpellcheckSettings(settings)
    try { localStorage.setItem(KEY, JSON.stringify(clean)) } catch { /* vale solo per questa sessione */ }
    return { settings: clean, status: {} }
  },
}
