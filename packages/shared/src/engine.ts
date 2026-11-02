export type EngineStatus = 'not-configured' | 'stopped' | 'starting' | 'ready' | 'analyzing' | 'error' | 'crashed'

export type EngineErrorCode =
  | 'spawn-failed' | 'handshake-failed' | 'timeout' | 'crashed'
  | 'invalid-option' | 'invalid-request' | 'not-ready'

export interface EngineState {
  status: EngineStatus
  profileId: string | null
  engineName: string | null
  engineAuthor: string | null
  error: { code: EngineErrorCode; message: string } | null
}

export type EngineOptionType = 'check' | 'spin' | 'combo' | 'string' | 'button'

/** Opzione dichiarata dal motore (riga "option name ..."), con il valore corrente */
export interface EngineOption {
  name: string
  type: EngineOptionType
  default: string | null
  min: number | null
  max: number | null
  vars: string[]
  value: string | null   // null per i pulsanti
  featured: boolean      // numero di linee, thread, hash, forza, tabelle: in evidenza nel pannello
}

export interface EngineProfile {
  id: string
  name: string
  path: string
  args: string[]
}

export interface EngineCandidate { token: string; path: string }

export type SearchMode = 'infinite' | 'depth' | 'time'

export interface EnginePrefs {
  mode: SearchMode
  depth: number
  timeMs: number
  autoStart: boolean
  showArrow: boolean   // freccia della mossa migliore sulla scacchiera
}

export const DEFAULT_ENGINE_PREFS: EnginePrefs = { mode: 'infinite', depth: 22, timeMs: 3000, autoStart: false, showArrow: true }

export interface EngineSystemInfo { cpus: number; memoryMb: number }

export interface AnalysisRequest {
  id: number
  fen: string
  mode: SearchMode
  depth: number
  timeMs: number
  newGame: boolean
}

/** Valutazione dal punto di vista del Bianco: positiva = meglio il Bianco; per i matti, positivo = matta il Bianco */
export interface AnalysisScore { kind: 'cp' | 'mate'; value: number }

export interface AnalysisLine {
  multipv: number
  depth: number
  seldepth: number | null
  score: AnalysisScore | null
  nodes: number | null
  nps: number | null
  timeMs: number | null
  hashfull: number | null
  pv: string[]   // mosse in notazione UCI (e2e4)
}

export type EngineEvent =
  | { type: 'state'; state: EngineState }
  | { type: 'options'; options: EngineOption[] }
  | { type: 'profiles'; profiles: EngineProfile[]; activeProfileId: string | null }
  | { type: 'prefs'; prefs: EnginePrefs }
  | { type: 'update'; id: number; lines: AnalysisLine[] }
  | { type: 'finished'; id: number; bestMove: string | null; reason: 'done' | 'stopped' | 'error' }

export interface EngineSnapshot {
  state: EngineState
  options: EngineOption[]
  profiles: EngineProfile[]
  activeProfileId: string | null
  prefs: EnginePrefs,
  system: EngineSystemInfo
}

export type EngineResult<T = void> = { ok: true; value: T } | { ok: false; message: string }

export interface EngineBridge {
  snapshot(): Promise<EngineResult<EngineSnapshot>>
  detect(): Promise<EngineResult<EngineCandidate[]>>
  /** Dialogo nativo di scelta dell'eseguibile, verifica UCI e creazione del profilo. value null = annullato */
  addProfile(args?: string[]): Promise<EngineResult<EngineProfile | null>>
  addDetected(token: string, args?: string[]): Promise<EngineResult<EngineProfile>>
  updateProfile(id: string, patch: { name?: string; args?: string[] }): Promise<EngineResult>
  removeProfile(id: string): Promise<EngineResult>
  setActiveProfile(id: string): Promise<EngineResult>
  enable(): Promise<EngineResult>
  disable(): Promise<EngineResult>
  setOption(name: string, value: string): Promise<EngineResult>
  pressButton(name: string): Promise<EngineResult>
  resetOptions(): Promise<EngineResult>
  setPrefs(patch: Partial<EnginePrefs>): Promise<EngineResult>
  analyze(req: AnalysisRequest): Promise<EngineResult>
  stopAnalysis(): Promise<EngineResult>
  onEvent(cb: (e: EngineEvent) => void): () => void
}