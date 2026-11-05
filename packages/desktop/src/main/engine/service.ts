import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import type {
  AnalysisRequest, EngineCandidate, EngineEvent, EnginePrefs, EngineProfile, EngineResult, EngineSnapshot,
} from '@mtc/shared'
import { detectEngines } from './detect.js'
import { EngineManager, type LaunchSpec } from './engineManager.js'
import { MAX_PROFILES, SettingsStore, cleanArgs, cleanPrefs, cleanText, type StoredProfile } from './settingsStore.js'
import os from 'node:os'

export interface EngineServiceDeps {
  userDataDir: string
  emit(e: EngineEvent): void
  /** Dialogo nativo di scelta dell'eseguibile. null = annullato */
  pickExecutable(): Promise<string | null>
}

const ok = <T>(value: T): EngineResult<T> => ({ ok: true, value })
const str = (x: unknown): string => {
  if (typeof x !== 'string') throw new Error('Richiesta non valida.')
  return x
}
const obj = (x: unknown): Record<string, unknown> => {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Richiesta non valida.')
  return x as Record<string, unknown>
}

export class EngineService {
  private readonly settings: SettingsStore
  private readonly manager: EngineManager
  private readonly detected = new Map<string, string>() // token -> percorso, dall'ultima ricerca: la pagina usa solo il token

  constructor(private readonly deps: EngineServiceDeps) {
    this.settings = new SettingsStore(path.join(deps.userDataDir, 'engine-settings.json'))
    this.manager = new EngineManager({
      onState: (state) => deps.emit({ type: 'state', state }),
      onOptions: (options) => deps.emit({ type: 'options', options }),
      onUpdate: ({ id, lines }) => deps.emit({ type: 'update', id, lines }),
      onFinished: (f) => deps.emit({ type: 'finished', ...f }),
      onLog: (line) => { if (process.env.MTC_ENGINE_LOG) console.log('[engine]', line) },
    })
  }

  async init() {
    await this.settings.load()
    const active = this.active()
    this.manager.markIdle(!!active, active?.id ?? null)
    if (active && this.settings.data.prefs.autoStart) void this.enable().catch(() => { /* lo stato porta l'errore */ })
  }

  async shutdown() { await this.manager.stop() }
  killNow() { this.manager.killNow() }

  // --- Stato ---
  private active(): StoredProfile | undefined {
    const { profiles, activeProfileId } = this.settings.data
    return profiles.find((p) => p.id === activeProfileId)
  }

  private publicProfiles(): EngineProfile[] {
    return this.settings.data.profiles.map(({ id, name, path: p, args }) => ({ id, name, path: p, args }))
  }

  private emitProfiles() {
    this.deps.emit({ type: 'profiles', profiles: this.publicProfiles(), activeProfileId: this.settings.data.activeProfileId })
  }

  snapshot(): EngineSnapshot {
    return {
      state: this.manager.getState(),
      options: this.manager.getOptions(),
      profiles: this.publicProfiles(),
      activeProfileId: this.settings.data.activeProfileId,
      prefs: this.settings.data.prefs,
      system: { cpus: os.availableParallelism(), memoryMb: Math.round(os.totalmem() / 1048576) },
    }
  }

  // --- Profili ---
  private async registerProfile(filePath: string, args: string[]): Promise<EngineProfile> {
    const info = await stat(filePath).catch(() => null)
    if (!info?.isFile()) throw new Error('Il file indicato non esiste.')
    if (this.settings.data.profiles.length >= MAX_PROFILES) throw new Error('Troppi profili configurati.')

    // Prova a motore separato: handshake completo, poi si chiude
    const probe = new EngineManager({ onState() {}, onOptions() {}, onUpdate() {}, onFinished() {} })
    await probe.start({ profileId: null, path: filePath, args, options: {} })
    const st = probe.getState()
    await probe.stop()
    if (st.status !== 'ready') {
      throw new Error(`${st.error?.message ?? 'Il programma non risponde come un motore UCI.'} Se il motore richiede argomenti di avvio, indicali nel profilo.`)
    }

    const profile: StoredProfile = {
      id: randomUUID(),
      name: cleanText(st.engineName, 100) || path.basename(filePath, path.extname(filePath)),
      path: filePath, args, options: {},
    }
    this.settings.data.profiles.push(profile)
    if (!this.settings.data.activeProfileId) this.settings.data.activeProfileId = profile.id
    await this.settings.save()
    this.emitProfiles()
    if (this.settings.data.activeProfileId === profile.id) this.manager.markIdle(true, profile.id)
    return { id: profile.id, name: profile.name, path: profile.path, args: profile.args }
  }

  private async addProfile(args: unknown): Promise<EngineProfile | null> {
    const list = cleanArgs(args, true)
    const file = await this.deps.pickExecutable()
    return file ? this.registerProfile(file, list) : null
  }

  private async detect(): Promise<EngineCandidate[]> {
    this.detected.clear()
    const out: EngineCandidate[] = []
    for (const p of await detectEngines()) {
      const token = randomUUID()
      this.detected.set(token, p)
      out.push({ token, path: p })
    }
    return out
  }

  private async addDetected(token: string, args: unknown): Promise<EngineProfile> {
    const file = this.detected.get(token)
    if (!file) throw new Error('Motore non più disponibile: ripeti la ricerca.')
    return this.registerProfile(file, cleanArgs(args, true))
  }

  private async updateProfile(id: string, patch: Record<string, unknown>) {
    const p = this.settings.data.profiles.find((x) => x.id === id)
    if (!p) throw new Error('Profilo non trovato.')
    if (patch.name !== undefined) {
      const name = cleanText(patch.name, 100)
      if (!name) throw new Error('Il nome non può essere vuoto.')
      p.name = name
    }
    if (patch.args !== undefined) p.args = cleanArgs(patch.args, true)
    await this.settings.save()
    this.emitProfiles()
  }

  private async removeProfile(id: string) {
    const { data } = this.settings
    if (!data.profiles.some((p) => p.id === id)) throw new Error('Profilo non trovato.')
    if (data.activeProfileId === id) await this.manager.stop()
    data.profiles = data.profiles.filter((p) => p.id !== id)
    if (data.activeProfileId === id) data.activeProfileId = data.profiles[0]?.id ?? null
    await this.settings.save()
    this.emitProfiles()
    this.manager.markIdle(!!this.active(), this.active()?.id ?? null)
  }

  private async setActiveProfile(id: string) {
    const { data } = this.settings
    if (!data.profiles.some((p) => p.id === id)) throw new Error('Profilo non trovato.')
    if (data.activeProfileId === id) return
    await this.manager.stop() // un solo motore per volta
    data.activeProfileId = id
    await this.settings.save()
    this.emitProfiles()
    this.manager.markIdle(true, id)
  }

  // --- Ciclo di vita e opzioni ---
  private spec(p: StoredProfile): LaunchSpec {
    return { profileId: p.id, path: p.path, args: p.args, options: p.options }
  }

  private async enable() {
    const p = this.active()
    if (!p) throw new Error('Nessun motore configurato.')
    await this.manager.start(this.spec(p))
    const st = this.manager.getState()
    if (st.status !== 'ready') throw new Error(st.error?.message ?? 'Avvio non riuscito.')
  }

  private async setOption(name: string, value: string) {
    const p = this.active()
    if (!p) throw new Error('Nessun motore configurato.')
    const applied = await this.manager.setOption(name, value)
    const opt = this.manager.getOptions().find((o) => o.name.toLowerCase() === name.toLowerCase())
    const key = opt?.name ?? name
    if (opt && applied === opt.default) delete p.options[key]
    else p.options[key] = applied
    await this.settings.save()
  }

  private async resetOptions() {
    const p = this.active()
    await this.manager.resetOptions()
    if (p) { p.options = {}; await this.settings.save() }
  }

  private async setPrefs(patch: Record<string, unknown>) {
    this.settings.data.prefs = cleanPrefs({ ...this.settings.data.prefs, ...patch })
    await this.settings.save()
    this.deps.emit({ type: 'prefs', prefs: this.settings.data.prefs as EnginePrefs })
  }

  // --- Punto d'ingresso dell'IPC ---
  async call(method: string, args: unknown[]): Promise<EngineResult<unknown>> {
    try {
      switch (method) {
        case 'snapshot': return ok(this.snapshot())
        case 'detect': return ok(await this.detect())
        case 'addProfile': return ok(await this.addProfile(args[0]))
        case 'addDetected': return ok(await this.addDetected(str(args[0]), args[1]))
        case 'updateProfile': await this.updateProfile(str(args[0]), obj(args[1])); return ok(undefined)
        case 'removeProfile': await this.removeProfile(str(args[0])); return ok(undefined)
        case 'setActiveProfile': await this.setActiveProfile(str(args[0])); return ok(undefined)
        case 'enable': await this.enable(); return ok(undefined)
        case 'disable': await this.manager.stop(); return ok(undefined)
        case 'setOption': await this.setOption(str(args[0]), str(args[1])); return ok(undefined)
        case 'pressButton': await this.manager.pressButton(str(args[0])); return ok(undefined)
        case 'resetOptions': await this.resetOptions(); return ok(undefined)
        case 'setPrefs': await this.setPrefs(obj(args[0])); return ok(undefined)
        case 'analyze': this.manager.analyze(obj(args[0]) as unknown as AnalysisRequest); return ok(undefined)
        case 'stopAnalysis': this.manager.stopAnalysis(); return ok(undefined)
        default: return { ok: false, message: 'Metodo sconosciuto.' }
      }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  }
}