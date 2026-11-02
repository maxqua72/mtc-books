import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_ENGINE_PREFS, type EnginePrefs, type SearchMode } from '@mtc/shared'
import { writeAtomic } from '../fsUtil.js'

export interface StoredProfile {
  id: string
  name: string
  path: string
  args: string[]
  options: Record<string, string>   // valori diversi dal predefinito, per nome di opzione
}

export interface StoredSettings {
  version: 1
  activeProfileId: string | null
  profiles: StoredProfile[]
  prefs: EnginePrefs
}

export const MAX_PROFILES = 20
const ID = /^[\w-]{1,64}$/
const MODES: SearchMode[] = ['infinite', 'depth', 'time']
const clampInt = (v: unknown, min: number, max: number, def: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def

export const cleanText = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\x00-\x1f]/g, '').trim().slice(0, max) : ''

/** strict: lancia se non valido (richieste dalla pagina). Altrimenti scarta ciò che non va (file salvato). */
export function cleanArgs(v: unknown, strict = false): string[] {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) { if (strict) throw new Error('Argomenti non validi.'); return [] }
  const out: string[] = []
  for (const a of v) {
    if (typeof a !== 'string' || a.length > 500 || /[\x00\r\n]/.test(a)) {
      if (strict) throw new Error('Argomento non valido.')
      continue
    }
    out.push(a)
  }
  if (out.length > 20) { if (strict) throw new Error('Troppi argomenti.'); return out.slice(0, 20) }
  return out
}

function cleanOptions(v: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 200)) {
    if (k.length > 100 || /[\x00-\x1f]/.test(k) || typeof val !== 'string' || val.length > 1000) continue
    out[k] = val
  }
  return out
}

export function cleanPrefs(v: unknown): EnginePrefs {
  const r = v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  return {
    mode: MODES.includes(r.mode as SearchMode) ? (r.mode as SearchMode) : DEFAULT_ENGINE_PREFS.mode,
    depth: clampInt(r.depth, 1, 99, DEFAULT_ENGINE_PREFS.depth),
    timeMs: clampInt(r.timeMs, 100, 600_000, DEFAULT_ENGINE_PREFS.timeMs),
    autoStart: r.autoStart === true,
    showArrow: r.showArrow !== false,
  }
}

const defaults = (): StoredSettings =>
  ({ version: 1, activeProfileId: null, profiles: [], prefs: { ...DEFAULT_ENGINE_PREFS } })

function sanitize(raw: unknown): StoredSettings {
  if (!raw || typeof raw !== 'object') return defaults()
  const r = raw as Record<string, unknown>
  const profiles: StoredProfile[] = []
  if (Array.isArray(r.profiles)) {
    for (const p of r.profiles.slice(0, MAX_PROFILES)) {
      if (!p || typeof p !== 'object') continue
      const q = p as Record<string, unknown>
      if (typeof q.id !== 'string' || !ID.test(q.id) || typeof q.path !== 'string' || !q.path) continue
      if (profiles.some((x) => x.id === q.id)) continue
      profiles.push({
        id: q.id,
        name: cleanText(q.name, 100) || path.basename(q.path),
        path: q.path,
        args: cleanArgs(q.args),
        options: cleanOptions(q.options),
      })
    }
  }
  const active = typeof r.activeProfileId === 'string' && profiles.some((p) => p.id === r.activeProfileId)
    ? r.activeProfileId : profiles[0]?.id ?? null
  return { version: 1, activeProfileId: active, profiles, prefs: cleanPrefs(r.prefs) }
}

export class SettingsStore {
  data: StoredSettings = defaults()
  constructor(private readonly file: string) {}

  async load() {
    try {
      this.data = sanitize(JSON.parse(await readFile(this.file, 'utf-8')))
    } catch {
      this.data = defaults()
    }
  }

  async save() {
    await writeAtomic(this.file, new TextEncoder().encode(JSON.stringify(this.data, null, 2)))
  }
}