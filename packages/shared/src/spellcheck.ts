/** Lingue proposte nelle impostazioni dell'app desktop. Nella web app le decide il browser */
export const SPELLCHECK_LANGUAGES = [
  { code: 'it-IT', label: 'Italiano' },
  { code: 'en-US', label: 'English' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
] as const

export interface SpellcheckSettings {
  enabled: boolean
  languages: string[]
}

/** Spento finché l'utente non lo attiva: nessun dizionario viene scaricato senza il suo consenso */
export const DEFAULT_SPELLCHECK: SpellcheckSettings = { enabled: false, languages: ['it-IT'] }

/** Impostazioni valide a partire da dati di qualunque provenienza (pagina, file): almeno una lingua, solo tra quelle previste */
export function cleanSpellcheckSettings(raw: unknown): SpellcheckSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SpellcheckSettings>
  const wanted = Array.isArray(r.languages) ? r.languages : []
  const languages = SPELLCHECK_LANGUAGES.map((l) => l.code as string).filter((code) => wanted.includes(code))
  return { enabled: r.enabled === true, languages: languages.length ? languages : [...DEFAULT_SPELLCHECK.languages] }
}

export type SpellcheckLanguageState = 'downloading' | 'ready' | 'failed'
export type SpellcheckStatus = Record<string, SpellcheckLanguageState>

export interface SpellcheckSnapshot {
  settings: SpellcheckSettings
  status: SpellcheckStatus
}

export interface SpellcheckBridge {
  get(): Promise<SpellcheckSnapshot>
  set(settings: SpellcheckSettings): Promise<SpellcheckSnapshot>
  onStatus(cb: (status: SpellcheckStatus) => void): () => void
}
