import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { Chess } from 'chess.js'
import {
  DEFAULT_ENGINE_PREFS,
  type AnalysisLine, type EngineCandidate, type EngineEvent, type EngineOption, type EnginePrefs,
  type EngineProfile, type EngineResult, type EngineSnapshot, type EngineState, type EngineSystemInfo,
} from '@mtc/shared'
import { platform } from '../platform'

const EMPTY: EngineState = { status: 'not-configured', profileId: null, engineName: null, engineAuthor: null, error: null }

export const useEngineStore = defineStore('engine', () => {
  const api = platform.engine ?? null
  const available = api !== null

  const state = ref<EngineState>({ ...EMPTY })
  const options = ref<EngineOption[]>([])
  const profiles = ref<EngineProfile[]>([])
  const activeProfileId = ref<string | null>(null)
  const prefs = ref<EnginePrefs>({ ...DEFAULT_ENGINE_PREFS })
  const system = ref<EngineSystemInfo>({ cpus: 1, memoryMb: 4096 })
  const lines = ref<AnalysisLine[]>([])
  const analyzedFen = ref<string | null>(null)   // posizione a cui si riferiscono le linee
  const bestMove = ref<string | null>(null)
  const positionNote = ref<string | null>(null)  // "Scacco matto", "Stallo"...
  const lastError = ref<string | null>(null)

  let off: (() => void) | null = null
  let seq = 0
  let currentId = 0
  let wantedFen: string | null = null

  const isRunning = computed(() => state.value.status === 'ready' || state.value.status === 'analyzing')
  const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) ?? null)
  const featuredOptions = computed(() => options.value.filter((o) => o.featured))
  const advancedOptions = computed(() => options.value.filter((o) => !o.featured))

  const resetAnalysis = () => { currentId = 0; lines.value = []; analyzedFen.value = null; bestMove.value = null }

  function applySnapshot(s: EngineSnapshot) {
    state.value = s.state
    options.value = s.options
    profiles.value = s.profiles
    activeProfileId.value = s.activeProfileId
    prefs.value = s.prefs
    system.value = s.system
  }

  function onEvent(e: EngineEvent) {
    switch (e.type) {
      case 'state': {
        const previous = state.value.status
        state.value = e.state
        if (!isRunning.value) resetAnalysis()
        // Solo all'avvio: anche a fine analisi lo stato torna a «ready», ma l'analisi non va ripetuta
        else if (previous === 'starting' && e.state.status === 'ready' && wantedFen) analyzePosition(wantedFen, true)
        break
      }
      case 'options': options.value = e.options; break
      case 'profiles': profiles.value = e.profiles; activeProfileId.value = e.activeProfileId; break
      case 'prefs': prefs.value = e.prefs; break
      case 'update': if (e.id === currentId) lines.value = e.lines; break
      case 'finished': if (e.id === currentId && e.reason === 'done') bestMove.value = e.bestMove; break
    }
  }

  async function run<T>(job: () => Promise<EngineResult<T>>): Promise<EngineResult<T>> {
    if (!api) return { ok: false, message: 'Motore non disponibile.' }
    const r = await job()
    lastError.value = r.ok ? null : r.message
    return r
  }

  /** Da chiamare alla comparsa del pannello */
  async function init() {
    if (!api || off) return
    off = api.onEvent(onEvent)
    const r = await run(() => api.snapshot())
    if (r.ok) applySnapshot(r.value)
  }

  function dispose() { off?.(); off = null }

  const enable = () => run(() => api!.enable())
  const disable = () => run(() => api!.disable())
  const addProfile = (args: string[] = []) => run(() => api!.addProfile(args))
  const detect = (): Promise<EngineResult<EngineCandidate[]>> => run(() => api!.detect())
  const addDetected = (token: string, args: string[] = []) => run(() => api!.addDetected(token, args))
  const updateProfile = (id: string, patch: { name?: string; args?: string[] }) => run(() => api!.updateProfile(id, patch))
  const removeProfile = (id: string) => run(() => api!.removeProfile(id))
  const setActiveProfile = (id: string) => run(() => api!.setActiveProfile(id))
  const setOption = (name: string, value: string) => run(() => api!.setOption(name, value))
  const pressButton = (name: string) => run(() => api!.pressButton(name))
  const resetOptions = () => run(() => api!.resetOptions())

  async function setPrefs(patch: Partial<EnginePrefs>) {
    const r = await run(() => api!.setPrefs(patch))
    const changesSearch = 'mode' in patch || 'depth' in patch || 'timeMs' in patch
    if (r.ok && changesSearch && wantedFen) analyzePosition(wantedFen)
    return r
  }

  /** Analizza la posizione (di solito l'activeFen dello store alberi). Posizioni senza mosse legali non si inviano. */
  function analyzePosition(fen: string, newGame = false) {
    wantedFen = fen
    if (!api || !isRunning.value) return

    let note: string | null = null
    try {
      const game = new Chess(fen)
      if (game.isCheckmate()) note = 'Scacco matto'
      else if (game.isStalemate()) note = 'Stallo'
      else if (game.isDraw()) note = 'Patta'
    } catch {
      note = 'Posizione non valida'
    }
    positionNote.value = note
    if (note) {
      void api.stopAnalysis()
      resetAnalysis()
      return
    }

    currentId = ++seq
    lines.value = []
    bestMove.value = null
    analyzedFen.value = fen
    const p = prefs.value
    void run(() => api.analyze({ id: currentId, fen, mode: p.mode, depth: p.depth, timeMs: p.timeMs, newGame }))
  }

  function stopAnalysis() {
    resetAnalysis()
    if (api && isRunning.value) void api.stopAnalysis()
  }

  return {
    available, state, options, profiles, activeProfileId, prefs, system, lines, analyzedFen, bestMove, positionNote, lastError,
    isRunning, activeProfile, featuredOptions, advancedOptions,
    init, dispose, enable, disable, addProfile, detect, addDetected, updateProfile, removeProfile, setActiveProfile,
    setOption, pressButton, resetOptions, setPrefs, analyzePosition, stopAnalysis,
  }
})