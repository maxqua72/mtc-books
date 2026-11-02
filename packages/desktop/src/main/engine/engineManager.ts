import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import type {
  AnalysisLine, AnalysisRequest, EngineErrorCode, EngineOption, EngineState, EngineStatus,
} from '@mtc/shared'
import {
  LineBuffer, cmd, encodeValue, normalizeOptionValue, parseLine, toWhitePov, whiteToMove,
  type ParsedInfo, type ParsedOption,
} from './uci.js'

type Proc = ChildProcessByStdio<Writable, Readable, Readable>
type Timer = ReturnType<typeof setTimeout>

export class EngineError extends Error {
  readonly code: EngineErrorCode
  constructor(code: EngineErrorCode, message: string) {
    super(message)
    this.name = 'EngineError'
    this.code = code
  }
}

export interface EngineHandlers {
  onState(state: EngineState): void
  onOptions(options: EngineOption[]): void
  onUpdate(update: { id: number; lines: AnalysisLine[] }): void
  onFinished(f: { id: number; bestMove: string | null; reason: 'done' | 'stopped' | 'error' }): void
  onLog?(line: string): void
}

export interface LaunchSpec {
  profileId: string | null
  path: string
  args: string[]
  options: Record<string, string>
}

export interface Timeouts {
  handshakeMs: number
  readyMs: number
  quitMs: number
  stopMs: number
  pingEveryMs: number
  pingTimeoutMs: number
  updateEveryMs: number
}

const DEFAULT_TIMEOUTS: Timeouts = {
  handshakeMs: 10_000, readyMs: 10_000, quitMs: 1_500, stopMs: 5_000,
  pingEveryMs: 15_000, pingTimeoutMs: 5_000, updateEveryMs: 120,
}

const FEATURED = new Set(['multipv', 'threads', 'hash', 'skill level', 'uci_limitstrength', 'uci_elo', 'syzygypath'])

interface Waiter { resolve(): void; reject(e: Error): void }

interface Job {
  req: AnalysisRequest
  whiteMoves: boolean
  lines: Map<number, AnalysisLine>
  stopRequested: boolean
  dirty: boolean
  lastEmit: number
  emitTimer: Timer | null
  stopTimer: Timer | null
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const toEngineError = (e: unknown, fallback: EngineErrorCode) => (e instanceof EngineError ? e : new EngineError(fallback, msg(e)))

export class EngineManager {
  private readonly t: Timeouts
  private proc: Proc | null = null
  private readonly expected = new WeakSet<object>() // processi che abbiamo chiuso noi: la loro uscita non è un crash
  private lineBuf = new LineBuffer()

  private status: EngineStatus = 'not-configured'
  private profileId: string | null = null
  private engineName: string | null = null
  private engineAuthor: string | null = null
  private error: { code: EngineErrorCode; message: string } | null = null
  private options: EngineOption[] = []

  private uciok: Waiter | null = null
  private readyWaiters: Waiter[] = []
  private jobWaiters: Array<() => void> = []

  private job: Job | null = null
  private wanted: AnalysisRequest | null = null
  private pumping = false
  private cancelEpoch = 0
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private ops: Promise<unknown> = Promise.resolve()

  constructor(private readonly handlers: EngineHandlers, timeouts: Partial<Timeouts> = {}) {
    this.t = { ...DEFAULT_TIMEOUTS, ...timeouts }
  }

  // ---------------------------------------------------------------------------
  // Stato
  // ---------------------------------------------------------------------------
  getState(): EngineState {
    return {
      status: this.status, profileId: this.profileId,
      engineName: this.engineName, engineAuthor: this.engineAuthor, error: this.error,
    }
  }

  getOptions(): EngineOption[] {
    return this.options.map((o) => ({ ...o, vars: [...o.vars] }))
  }

  private setStatus(status: EngineStatus) {
    this.status = status
    if (status !== 'error' && status !== 'crashed') this.error = null
    this.handlers.onState(this.getState())
  }

  /** Senza processo attivo: 'stopped' se c'è un profilo, altrimenti 'not-configured' */
  markIdle(configured: boolean, profileId: string | null = null) {
    if (this.proc || this.status === 'starting') return
    this.profileId = profileId
    this.engineName = null
    this.engineAuthor = null
    this.options = []
    this.setStatus(configured ? 'stopped' : 'not-configured')
  }

  // ---------------------------------------------------------------------------
  // Avvio e chiusura
  // ---------------------------------------------------------------------------
  async start(spec: LaunchSpec): Promise<void> {
    if (this.proc) await this.stop()
    this.profileId = spec.profileId
    this.engineName = null
    this.engineAuthor = null
    this.options = []
    this.job = null
    this.wanted = null
    this.handlers.onOptions([])
    this.setStatus('starting')

    let child: Proc
    try {
      child = spawn(spec.path, spec.args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: false })
    } catch (e) {
      return this.breakDown('spawn-failed', `Impossibile avviare il programma: ${msg(e)}`, 'error')
    }
    this.proc = child
    this.lineBuf = new LineBuffer()
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (d: string | Buffer) => this.onData(child, String(d)))
    child.stderr.on('data', (d: string | Buffer) => this.handlers.onLog?.(`[stderr] ${String(d).trim()}`))
    child.stdin.on('error', () => { /* pipe chiusa: se ne occupa 'exit' */ })
    child.on('error', (e) => this.onProcessError(child, e))
    child.on('exit', (code, signal) => this.onExit(child, code, signal))

    try {
      await this.handshake()
      this.applyStored(spec.options)
      await this.waitReady()
      if (this.proc !== child) throw new EngineError('crashed', 'Il motore si è chiuso durante l’avvio.')
      this.setStatus('ready')
      this.handlers.onOptions(this.getOptions())
    } catch (e) {
      if (this.expected.has(child)) return // fermato apposta mentre si avviava
      const err = toEngineError(e, 'handshake-failed')
      this.breakDown(err.code, err.message, 'error')
    }
  }

  async stop(): Promise<void> {
    this.wanted = null
    const child = this.proc
    if (!child) {
      if (this.status !== 'not-configured' && this.status !== 'stopped') this.setStatus('stopped')
      return
    }
    this.expected.add(child)
    const job = this.job
    this.job = null
    this.dropJobTimers(job)
    this.stopPing()
    if (job) this.handlers.onFinished({ id: job.req.id, bestMove: null, reason: 'stopped' })
    this.jobWaiters.splice(0).forEach((r) => r())
    this.rejectAll(new EngineError('not-ready', 'Il motore è stato fermato.'))

    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))
    try {
      if (job) child.stdin.write('stop\n')
      child.stdin.write('quit\n')
    } catch { /* già chiuso */ }
    const killTimer = setTimeout(() => { try { child.kill() } catch { /* già chiuso */ } }, this.t.quitMs)
    await Promise.race([exited, new Promise<void>((r) => setTimeout(r, this.t.quitMs + 1500))])
    clearTimeout(killTimer)
    if (this.proc === child) this.proc = null
    this.setStatus('stopped')
  }

  /** Chiusura sincrona, per l'uscita dell'applicazione */
  killNow() {
    const child = this.proc
    if (!child) return
    this.expected.add(child)
    try { child.kill() } catch { /* già chiuso */ }
  }

  private onProcessError(child: Proc, e: Error) {
    if (child === this.proc) this.proc = null // spawn fallito: 'exit' non arriverà
    const message = (e as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'Il file del motore non esiste più.'
      : `Impossibile avviare il programma: ${e.message}`
    this.rejectAll(new EngineError('spawn-failed', message))
  }

  private onExit(child: Proc, code: number | null, signal: NodeJS.Signals | null) {
    const wasCurrent = child === this.proc
    if (wasCurrent) this.proc = null
    if (!wasCurrent || this.expected.has(child)) return
    const detail = signal ? `segnale ${signal}` : `codice ${code}`
    if (this.status === 'starting') {
      this.rejectAll(new EngineError('handshake-failed',
        `Il programma si è chiuso subito (${detail}): probabilmente non è un motore UCI o mancano file necessari.`))
      return
    }
    this.breakDown('crashed', `Il motore si è chiuso inaspettatamente (${detail}).`, 'crashed')
  }

  /** Guasto: ferma tutto, avvisa chi aspettava e porta lo stato a error/crashed */
  private breakDown(code: EngineErrorCode, message: string, status: 'error' | 'crashed') {
    const child = this.proc
    if (child) {
      this.expected.add(child)
      this.proc = null
      try { child.kill() } catch { /* già chiuso */ }
    }
    const job = this.job
    this.job = null
    this.wanted = null
    this.dropJobTimers(job)
    this.stopPing()
    if (job) this.handlers.onFinished({ id: job.req.id, bestMove: null, reason: 'error' })
    this.jobWaiters.splice(0).forEach((r) => r())
    this.rejectAll(new EngineError(code, message))
    this.error = { code, message }
    this.setStatus(status)
  }

  // ---------------------------------------------------------------------------
  // Handshake e attese
  // ---------------------------------------------------------------------------
  private send(line: string) {
    const p = this.proc
    if (!p || !p.stdin.writable) return
    p.stdin.write(`${line}\n`)
  }

  private handshake(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.uciok = null
        reject(new EngineError('handshake-failed', 'Il programma non ha risposto a «uci»: non sembra un motore UCI.'))
      }, this.t.handshakeMs)
      this.uciok = {
        resolve: () => { clearTimeout(timer); resolve() },
        reject: (e) => { clearTimeout(timer); reject(e) },
      }
      this.send('uci')
    })
  }

  private waitReady(ms = this.t.readyMs): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve: () => { clearTimeout(timer); resolve() },
        reject: (e) => { clearTimeout(timer); reject(e) },
      }
      const timer = setTimeout(() => {
        const i = this.readyWaiters.indexOf(waiter)
        if (i >= 0) this.readyWaiters.splice(i, 1)
        reject(new EngineError('timeout', 'Il motore non risponde.'))
      }, ms)
      this.readyWaiters.push(waiter)
      this.send('isready')
    })
  }

  private rejectAll(err: Error) {
    const u = this.uciok
    this.uciok = null
    u?.reject(err)
    this.readyWaiters.splice(0).forEach((w) => w.reject(err))
  }

  private applyStored(stored: Record<string, string>) {
    for (const [name, value] of Object.entries(stored)) {
      const opt = this.find(name)
      if (!opt || opt.type === 'button') continue
      try {
        const v = normalizeOptionValue(opt, value)
        this.send(cmd.setOption(opt.name, v))
        opt.value = v
      } catch (e) {
        this.handlers.onLog?.(`Opzione salvata ignorata (${name}): ${msg(e)}`)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Lettura dell'output
  // ---------------------------------------------------------------------------
  private onData(child: Proc, chunk: string) {
    if (child !== this.proc) return
    for (const line of this.lineBuf.push(chunk)) this.handleLine(line)
  }

  private handleLine(line: string) {
    const m = parseLine(line)
    switch (m.kind) {
      case 'id':
        if (m.field === 'name') this.engineName = m.value
        else this.engineAuthor = m.value
        break
      case 'option': this.options.push(this.toDescriptor(m.option)); break
      case 'uciok': { const u = this.uciok; this.uciok = null; u?.resolve(); break }
      case 'readyok': this.readyWaiters.shift()?.resolve(); break
      case 'info':
        if (m.info.string !== undefined) this.handlers.onLog?.(m.info.string)
        else this.onInfo(m.info)
        break
      case 'bestmove': this.finishJob(m.move); break
      default: this.handlers.onLog?.(m.line)
    }
  }

  private toDescriptor(p: ParsedOption): EngineOption {
    return {
      name: p.name, type: p.type, default: p.default, min: p.min, max: p.max, vars: p.vars,
      value: p.type === 'button' ? null : p.default,
      featured: FEATURED.has(p.name.toLowerCase()),
    }
  }

  private find(name: string): EngineOption | undefined {
    const n = name.toLowerCase()
    return this.options.find((o) => o.name.toLowerCase() === n)
  }

  // ---------------------------------------------------------------------------
  // Analisi: l'ultima richiesta vince
  // ---------------------------------------------------------------------------
  analyze(req: AnalysisRequest): void {
    if (this.status !== 'ready' && this.status !== 'analyzing') {
      throw new EngineError('not-ready', 'Il motore non è pronto.')
    }
    if (!Number.isInteger(req.id) || req.id < 0 || typeof req.fen !== 'string' || req.fen.length > 200 ||
      /[\r\n\0]/.test(req.fen) || !['infinite', 'depth', 'time'].includes(req.mode) ||
      !Number.isFinite(req.depth) || req.depth < 1 || req.depth > 99 ||
      !Number.isFinite(req.timeMs) || req.timeMs < 50 || req.timeMs > 600_000) {
      throw new EngineError('invalid-request', 'Richiesta di analisi non valida.')
    }
    this.wanted = { ...req, newGame: !!req.newGame }
    void this.pump()
  }

  stopAnalysis(): void {
    this.wanted = null
    this.cancelEpoch++
    if (this.job) this.requestStop()
  }

  private async pump(): Promise<void> {
    if (this.pumping) return
    this.pumping = true
    try {
      for (;;) {
        if (!this.proc || (this.status !== 'ready' && this.status !== 'analyzing')) return
        if (this.job) { this.requestStop(); return } // finishJob richiamerà pump
        const req = this.wanted
        if (!req) return
        this.wanted = null
        await this.startJob(req)
        if (!this.wanted) return
      }
    } catch (e) {
      const err = toEngineError(e, 'timeout')
      this.breakDown(err.code, err.message, 'error')
    } finally {
      this.pumping = false
    }
  }

  private async startJob(req: AnalysisRequest) {
    const epoch = this.cancelEpoch
    if (req.newGame) {
      this.send('ucinewgame')
      await this.waitReady()
    }
    if (this.wanted || epoch !== this.cancelEpoch) { // nel frattempo c'è una richiesta più recente, o è stata annullata
      this.handlers.onFinished({ id: req.id, bestMove: null, reason: 'stopped' })
      return
    }
    if (!this.proc) return
    this.job = {
      req, whiteMoves: whiteToMove(req.fen), lines: new Map(), stopRequested: false,
      dirty: false, lastEmit: 0, emitTimer: null, stopTimer: null,
    }
    this.setStatus('analyzing')
    this.send(cmd.position(req.fen))
    this.send(cmd.go(req.mode, req.depth, req.timeMs))
    this.startPing()
  }

  private requestStop() {
    const job = this.job
    if (!job || job.stopRequested) return
    job.stopRequested = true
    this.send('stop')
    job.stopTimer = setTimeout(
      () => this.breakDown('timeout', 'Il motore non ha risposto al comando di arresto.', 'error'),
      this.t.stopMs
    )
  }

  private onInfo(info: ParsedInfo) {
    const job = this.job
    if (!job || job.stopRequested || info.depth === undefined || !info.pv) return
    const multipv = info.multipv ?? 1
    const prev = job.lines.get(multipv)
    if (info.score?.bound && prev) return // limiti provvisori della ricerca: si tiene l'ultima linea esatta
    const line: AnalysisLine = {
      multipv,
      depth: info.depth,
      seldepth: info.seldepth ?? null,
      score: info.score ? toWhitePov(info.score, job.whiteMoves) : prev?.score ?? null,
      nodes: info.nodes ?? null,
      nps: info.nps ?? null,
      timeMs: info.timeMs ?? null,
      hashfull: info.hashfull ?? null,
      pv: info.pv,
    }
    job.lines.set(multipv, line)
    job.dirty = true
    if (!job.emitTimer) {
      const wait = Math.max(0, job.lastEmit + this.t.updateEveryMs - Date.now())
      job.emitTimer = setTimeout(() => { job.emitTimer = null; this.emitLines(job) }, wait)
    }
  }

  private emitLines(job: Job) {
    if (!job.dirty || job.stopRequested) return
    job.dirty = false
    job.lastEmit = Date.now()
    this.handlers.onUpdate({
      id: job.req.id,
      lines: [...job.lines.values()].sort((a, b) => a.multipv - b.multipv),
    })
  }

  private dropJobTimers(job: Job | null) {
    if (!job) return
    if (job.emitTimer) clearTimeout(job.emitTimer)
    if (job.stopTimer) clearTimeout(job.stopTimer)
    job.emitTimer = null
    job.stopTimer = null
  }

  private finishJob(move: string | null) {
    const job = this.job
    if (!job) return // bestmove spurio
    this.job = null
    this.dropJobTimers(job)
    this.stopPing()
    this.emitLines(job)
    this.handlers.onFinished({ id: job.req.id, bestMove: move, reason: job.stopRequested ? 'stopped' : 'done' })
    if (this.wanted) void this.pump()
    else if (this.status === 'analyzing') this.setStatus('ready')
    this.jobWaiters.splice(0).forEach((r) => r())
  }

  // Controllo di vita: «isready» è ammesso anche durante la ricerca
  private startPing() {
    this.stopPing()
    this.pingTimer = setInterval(() => {
      if (!this.job) return
      this.waitReady(this.t.pingTimeoutMs).catch(() => this.breakDown('timeout', 'Il motore non risponde.', 'error'))
    }, this.t.pingEveryMs)
    this.pingTimer.unref?.()
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = null
  }

  // ---------------------------------------------------------------------------
  // Opzioni: si applicano a motore fermo e l'analisi riparte da sola
  // ---------------------------------------------------------------------------
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.ops.then(fn, fn)
    this.ops = run.catch(() => undefined)
    return run
  }

  private requireRunning() {
    if (this.status !== 'ready' && this.status !== 'analyzing') throw new EngineError('not-ready', 'Il motore non è pronto.')
  }

  private async whilePaused(fn: () => Promise<void>) {
    const resume = this.job ? this.job.req : this.wanted
    this.wanted = null
    if (this.job) await new Promise<void>((resolve) => { this.jobWaiters.push(resolve); this.requestStop() })
    await fn()
    if (resume && this.proc && (this.status === 'ready' || this.status === 'analyzing')) {
      this.wanted = { ...resume, newGame: false }
      void this.pump()
    }
  }

  /** Restituisce il valore normalizzato effettivamente applicato */
  setOption(name: string, value: string): Promise<string> {
    return this.serial(async () => {
      this.requireRunning()
      const opt = this.find(name)
      if (!opt || opt.type === 'button') throw new EngineError('invalid-option', `Opzione non disponibile: ${name}`)
      let v: string
      try { v = normalizeOptionValue(opt, value) } catch (e) { throw new EngineError('invalid-option', msg(e)) }
      await this.whilePaused(async () => {
        this.send(cmd.setOption(opt.name, v))
        await this.waitReady()
      })
      opt.value = v
      this.handlers.onOptions(this.getOptions())
      return v
    })
  }

  pressButton(name: string): Promise<void> {
    return this.serial(async () => {
      this.requireRunning()
      const opt = this.find(name)
      if (!opt || opt.type !== 'button') throw new EngineError('invalid-option', `Pulsante non disponibile: ${name}`)
      await this.whilePaused(async () => {
        this.send(cmd.setOption(opt.name))
        await this.waitReady()
      })
    })
  }

  resetOptions(): Promise<void> {
    return this.serial(async () => {
      this.requireRunning()
      await this.whilePaused(async () => {
        for (const opt of this.options) {
          if (opt.type === 'button' || opt.default === null || opt.value === opt.default) continue
          this.send(cmd.setOption(opt.name, encodeValue(opt.default)))
          opt.value = opt.default
        }
        await this.waitReady()
      })
      this.handlers.onOptions(this.getOptions())
    })
  }
}