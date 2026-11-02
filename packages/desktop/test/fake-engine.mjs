// Motore UCI finto: serve ai test. Il comportamento si sceglie con FAKE_MODE:
//   normal | silent (non risponde a "uci") | crash-on-go | slow-stop (bestmove 300 ms dopo "stop")
import readline from 'node:readline'

const mode = process.env.FAKE_MODE || 'normal'
const options = { Threads: '1', Hash: '16', MultiPV: '1', Style: 'Normal' }
let searching = null
const out = (s) => process.stdout.write(s + '\n')

function startSearch(args) {
  if (searching) clearInterval(searching)
  const at = (k) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : Infinity)
  const depthLimit = at('depth')
  const moveTime = at('movetime')
  const multi = Number(options.MultiPV)
  out(`info string options Threads=${options.Threads} Hash=${options.Hash} MultiPV=${options.MultiPV} Style=${options.Style}`)
  const started = Date.now()
  let depth = 0
  searching = setInterval(() => {
    depth++
    for (let k = 1; k <= multi; k++) {
      out(`info depth ${depth} seldepth ${depth + 2} multipv ${k} score cp ${10 * depth + k} nodes ${depth * 1000} nps 100000 time ${depth * 15} pv e2e4 e7e5 g1f3`)
    }
    if (depth >= depthLimit || Date.now() - started >= moveTime) {
      clearInterval(searching)
      searching = null
      out('bestmove e2e4 ponder e7e5')
    }
  }, 15)
}

function stopSearch() {
  if (!searching) return
  clearInterval(searching)
  searching = null
  const finish = () => out('bestmove e2e4 ponder e7e5')
  if (mode === 'slow-stop') setTimeout(finish, 300)
  else finish()
}

const rl = readline.createInterface({ input: process.stdin })
rl.on('line', (line) => {
  const [command, ...rest] = line.trim().split(/\s+/)
  if (command === 'uci') {
    if (mode === 'silent') return
    out('id name FakeFish 1.0')
    out('id author Test')
    out('option name Threads type spin default 1 min 1 max 64')
    out('option name Hash type spin default 16 min 1 max 4096')
    out('option name MultiPV type spin default 1 min 1 max 5')
    out('option name Skill Level type spin default 20 min 0 max 20')
    out('option name UCI_LimitStrength type check default false')
    out('option name Style type combo default Normal var Solid var Normal var Risky')
    out('option name SyzygyPath type string default <empty>')
    out('option name Clear Hash type button')
    out('uciok')
  } else if (command === 'isready') {
    out('readyok')
  } else if (command === 'setoption') {
    const m = /^setoption name (.+?)(?: value (.*))?$/.exec(line.trim())
    if (m) {
      options[m[1]] = m[2] ?? ''
      if (m[1] === 'Clear Hash') out('info string clear hash')
    }
  } else if (command === 'go') {
    if (mode === 'crash-on-go') process.exit(3)
    startSearch(rest)
  } else if (command === 'stop') {
    stopSearch()
  } else if (command === 'quit') {
    process.exit(0)
  }
})