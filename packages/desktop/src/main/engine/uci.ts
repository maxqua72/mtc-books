import type { AnalysisScore, EngineOptionType, SearchMode } from '@mtc/shared'

export interface ParsedOption {
  name: string
  type: EngineOptionType
  default: string | null
  min: number | null
  max: number | null
  vars: string[]
}

export interface ParsedInfo {
  depth?: number
  seldepth?: number
  multipv?: number
  score?: { kind: 'cp' | 'mate'; value: number; bound: 'lower' | 'upper' | null }
  nodes?: number
  nps?: number
  timeMs?: number
  hashfull?: number
  pv?: string[]
  string?: string
}

export type UciMessage =
  | { kind: 'id'; field: 'name' | 'author'; value: string }
  | { kind: 'uciok' }
  | { kind: 'readyok' }
  | { kind: 'option'; option: ParsedOption }
  | { kind: 'info'; info: ParsedInfo }
  | { kind: 'bestmove'; move: string | null; ponder: string | null }
  | { kind: 'other'; line: string }

const OPTION_KEYS = new Set(['default', 'min', 'max', 'var'])

const toInt = (s: string | undefined): number | undefined => {
  if (s === undefined) return undefined
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : undefined
}

function parseOption(line: string): ParsedOption | null {
  const m = /^option\s+name\s+(.+?)\s+type\s+(check|spin|combo|button|string)\b(.*)$/.exec(line)
  if (!m) return null
  const opt: ParsedOption = { name: m[1].trim(), type: m[2] as EngineOptionType, default: null, min: null, max: null, vars: [] }
  const tokens = m[3].trim().split(/\s+/).filter(Boolean)
  let i = 0
  while (i < tokens.length) {
    const key = tokens[i++]
    if (!OPTION_KEYS.has(key)) continue
    const parts: string[] = []
    while (i < tokens.length && !OPTION_KEYS.has(tokens[i])) parts.push(tokens[i++])
    const value = parts.join(' ')
    if (key === 'default') opt.default = value === '<empty>' ? '' : value
    else if (key === 'var') opt.vars.push(value)
    else {
      const n = Number(value)
      if (Number.isFinite(n)) { if (key === 'min') opt.min = n; else opt.max = n }
    }
  }
  return opt
}

function parseInfo(line: string): ParsedInfo | null {
  const t = line.split(/\s+/)
  const info: ParsedInfo = {}
  let i = 1
  while (i < t.length) {
    switch (t[i]) {
      case 'depth': info.depth = toInt(t[i + 1]); i += 2; break
      case 'seldepth': info.seldepth = toInt(t[i + 1]); i += 2; break
      case 'multipv': info.multipv = toInt(t[i + 1]); i += 2; break
      case 'nodes': info.nodes = toInt(t[i + 1]); i += 2; break
      case 'nps': info.nps = toInt(t[i + 1]); i += 2; break
      case 'time': info.timeMs = toInt(t[i + 1]); i += 2; break
      case 'hashfull': info.hashfull = toInt(t[i + 1]); i += 2; break
      case 'tbhits': case 'cpuload': case 'currmove': case 'currmovenumber': i += 2; break
      case 'wdl': i += 4; break
      case 'score': {
        const kind = t[i + 1]
        const value = toInt(t[i + 2])
        i += 3
        if ((kind === 'cp' || kind === 'mate') && value !== undefined) {
          let bound: 'lower' | 'upper' | null = null
          if (t[i] === 'lowerbound') { bound = 'lower'; i++ } else if (t[i] === 'upperbound') { bound = 'upper'; i++ }
          info.score = { kind, value, bound }
        }
        break
      }
      case 'pv': info.pv = t.slice(i + 1).filter(Boolean); i = t.length; break
      case 'string': info.string = t.slice(i + 1).join(' '); i = t.length; break
      case 'refutation': case 'currline': i = t.length; break
      default: i++
    }
  }
  const useful = info.depth !== undefined || info.pv !== undefined || info.score !== undefined || info.string !== undefined
  return useful ? info : null
}

export function parseLine(raw: string): UciMessage {
  const line = raw.trim()
  if (line === 'uciok') return { kind: 'uciok' }
  if (line === 'readyok') return { kind: 'readyok' }
  if (line.startsWith('id ')) {
    const m = /^id\s+(name|author)\s+(.*)$/.exec(line)
    if (m) return { kind: 'id', field: m[1] as 'name' | 'author', value: m[2].trim() }
  } else if (line.startsWith('option ')) {
    const option = parseOption(line)
    if (option) return { kind: 'option', option }
  } else if (line.startsWith('info ')) {
    const info = parseInfo(line)
    if (info) return { kind: 'info', info }
  } else if (line.startsWith('bestmove')) {
    const m = /^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/.exec(line)
    if (m) return { kind: 'bestmove', move: m[1] === '(none)' || m[1] === '0000' ? null : m[1], ponder: m[2] ?? null }
  }
  return { kind: 'other', line }
}

/** Ricompone le righe dai blocchi di output (che possono spezzarle a metà) */
export class LineBuffer {
  private buf = ''
  push(chunk: string): string[] {
    this.buf += chunk
    const parts = this.buf.split(/\r?\n/)
    this.buf = parts.pop() ?? ''
    if (this.buf.length > 65536) this.buf = '' // output anomalo senza fine riga: si scarta
    return parts
  }
}

const clean = (s: string): string => {
  if (/[\r\n\0]/.test(s)) throw new Error('Carattere non valido nel comando.')
  return s
}

/** Il valore vuoto si scrive «<empty>», come prevede la convenzione UCI */
export const encodeValue = (v: string): string => (v === '' ? '<empty>' : clean(v))

export const cmd = {
  setOption: (name: string, value?: string) =>
    `setoption name ${clean(name)}${value === undefined ? '' : ` value ${encodeValue(value)}`}`,
  position: (fen: string) => `position fen ${clean(fen)}`,
  go: (mode: SearchMode, depth: number, timeMs: number) =>
    mode === 'depth' ? `go depth ${Math.trunc(depth)}`
      : mode === 'time' ? `go movetime ${Math.trunc(timeMs)}`
        : 'go infinite',
}

/** Valida e normalizza il valore di un'opzione: lancia se non è ammesso, corregge i numeri fuori limite */
export function normalizeOptionValue(
  opt: Pick<ParsedOption, 'name' | 'type' | 'min' | 'max' | 'vars'>,
  raw: string
): string {
  const value = String(raw)
  if (/[\r\n\0]/.test(value)) throw new Error('Valore non valido.')
  switch (opt.type) {
    case 'check': {
      const v = value.trim().toLowerCase()
      if (v === 'true' || v === 'false') return v
      throw new Error(`«${opt.name}» accetta solo true o false.`)
    }
    case 'spin': {
      const n = Number(value.trim())
      if (!Number.isFinite(n)) throw new Error(`«${opt.name}» richiede un numero.`)
      let r = Math.round(n)
      if (opt.min !== null) r = Math.max(opt.min, r)
      if (opt.max !== null) r = Math.min(opt.max, r)
      return String(r)
    }
    case 'combo': {
      const hit = opt.vars.find((v) => v.toLowerCase() === value.trim().toLowerCase())
      if (!hit) throw new Error(`Valore non ammesso per «${opt.name}».`)
      return hit
    }
    case 'string':
      if (value.length > 1000) throw new Error('Valore troppo lungo.')
      return value
    default:
      throw new Error(`«${opt.name}» è un pulsante: non ha un valore.`)
  }
}

export const whiteToMove = (fen: string): boolean => fen.trim().split(/\s+/)[1] !== 'b'

/** Il motore valuta dal punto di vista di chi muove: per l'interfaccia si usa sempre quello del Bianco */
export const toWhitePov = (score: { kind: 'cp' | 'mate'; value: number }, whiteMoves: boolean): AnalysisScore => ({
  kind: score.kind,
  value: whiteMoves || score.value === 0 ? score.value : -score.value,
})