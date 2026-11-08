// Mosse dettate a voce («cavallo Firenze tre») → notazione algebrica inglese («Nf3»).
// Modulo puro: niente Vue, TipTap o DOM. Riceve una stringa, restituisce le sostituzioni con gli indici.

// ---------------------------------------------------------------------------
// Vocabolario (tutto minuscolo: le maiuscole non contano)
// ---------------------------------------------------------------------------

/** Colonne: alfabeto telefonico italiano */
export const FILES: Record<string, string> = {
  ancona: 'a', bologna: 'b', como: 'c', domodossola: 'd',
  empoli: 'e', firenze: 'f', genova: 'g', hotel: 'h',
}

/** Traverse: cifre o parole */
export const RANKS: Record<string, string> = {
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8',
  uno: '1', un: '1', due: '2', tre: '3', quattro: '4', cinque: '5', sei: '6', sette: '7', otto: '8',
}

/** Pezzi (il pedone non ha lettera) */
export const PIECES: Record<string, string> = {
  re: 'K', donna: 'Q', regina: 'Q', torre: 'R', alfiere: 'B', alfieri: 'B', cavallo: 'N', cavalli: 'N',
}

/** Parola facoltativa davanti a una mossa di pedone */
export const PAWN_WORD = 'pedone'

export const CAPTURE_WORDS = ['prende', 'per', 'cattura', 'mangia']

/** Sequenze di parole → simbolo (si prova sempre la più lunga) */
export const CHECK_WORDS: [string[], string][] = [
  [['scacco', 'matto'], '#'],
  [['matto'], '#'],
  [['scacco'], '+'],
]

export const PROMOTION_WORDS: string[][] = [
  ['promuove', 'a'], ['promuove', 'in'], ['promozione', 'a'], ['promozione', 'in'],
  ['promuove'], ['uguale'],
]

/**
 * Arrocchi: varianti esplicite osservate nella dettatura (niente distanza di edit,
 * per non convertire frasi normali). Una parola di arrocco + un lato.
 */
export const CASTLE_WORDS: string[][] = [
  ['arrocco'], ['arroco'], ['arocco'], ['a', 'rocco'], ['a', 'roco'], ['rocco'],
]
export const CASTLE_SIDES: Record<string, string> = {
  corto: 'O-O', corta: 'O-O', cotto: 'O-O', cotta: 'O-O',
  lungo: 'O-O-O', lunga: 'O-O-O', longo: 'O-O-O', longa: 'O-O-O',
}
/**
 * Parole che la dettatura fonde con la «a» di «a rocco»: «e a rocco lungo» → «EA Rocco lungo».
 * Valgono solo davanti a «rocco» + lato; la parola iniziale («e») resta nel testo.
 */
export const CASTLE_LEADS: Record<string, string> = { ea: 'e' }
/** Arrocchi con le parole fuse dalla dettatura («a Roccolgo»): sequenze complete */
export const CASTLE_FUSED: [string[], string][] = [
  [['roccolgo'], 'O-O-O'], [['a', 'roccolgo'], 'O-O-O'], [['arroccolungo'], 'O-O-O'], [['arrocolungo'], 'O-O-O'],
  [['roccocorto'], 'O-O'], [['a', 'roccocorto'], 'O-O'], [['arroccocorto'], 'O-O'], [['roccocotto'], 'O-O'],
]

/** Punteggiatura staccata che si attacca alla mossa convertita («e5 .» → «e5.»); non ! e ?, segni di valutazione */
const DETACHED_PUNCT = /^\s+([.,;:])(?!\p{P})/u

/** Numeri di mossa in parole (1–99) */
const UNITS = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove',
  'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove']
const TENS = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta']

export const MOVE_NUMBERS: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  for (let n = 1; n < 100; n++) {
    out[String(n)] = n
    if (n < 20) { out[UNITS[n]] = n; continue }
    const ten = TENS[Math.floor(n / 10)]
    const unit = UNITS[n % 10]
    // ventuno, ventotto: la vocale finale della decina cade davanti a «uno» e «otto»
    const word = unit === 'uno' || unit === 'otto' ? ten.slice(0, -1) + unit : ten + unit
    out[word] = n
    // la dettatura scrive talvolta «tre» finale con l'accento: ventitré
    if (unit === 'tre') out[ten + 'tré'] = n
  }
  return out
})()

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface DictatedReplacement {
  start: number
  end: number
  original: string
  replacement: string
}

interface Token {
  word: string | null   // nucleo minuscolo senza punteggiatura ai bordi; null = barriera
  start: number          // inizio del nucleo nel testo
  end: number            // fine del nucleo nel testo
}

interface Hit {
  next: number
  san: string
  lead?: string   // parola che resta davanti alla mossa («e» di «EA Rocco lungo»)
}

// ---------------------------------------------------------------------------
// Tokenizzazione
// ---------------------------------------------------------------------------

const OBJECT_CHAR = '￼'   // nodo inline (riferimento a diagramma, a capo): nessuna mossa lo attraversa
const EDGE_PUNCT = /^[\p{P}\p{S}]*(.*?)[\p{P}\p{S}]*$/u

function tokenize(text: string): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(/\S+/g)) {
    const raw = m[0]
    if (raw.includes(OBJECT_CHAR)) { out.push({ word: null, start: m.index, end: m.index + raw.length }); continue }
    const core = EDGE_PUNCT.exec(raw)![1]
    if (!core) continue          // sola punteggiatura («–», «,»): dentro una sequenza sparisce
    const start = m.index + raw.indexOf(core)
    out.push({ word: core.toLowerCase(), start, end: start + core.length })
  }
  return out
}

// ---------------------------------------------------------------------------
// Grammatica
// ---------------------------------------------------------------------------

function parser(toks: Token[]) {
  const word = (i: number) => (i < toks.length ? toks[i].word : null)

  /** La sequenza più lunga (fra quelle date) che parte da i; restituisce l'indice successivo */
  const seq = (i: number, options: string[][]): number | null => {
    let best: number | null = null
    for (const words of options) {
      if (words.every((w, k) => word(i + k) === w) && (best === null || i + words.length > best)) best = i + words.length
    }
    return best
  }

  const file = (i: number, allowLetter: boolean): string | null => {
    const w = word(i)
    if (w === null) return null
    if (FILES[w]) return FILES[w]
    return allowLetter && /^[a-h]$/.test(w) ? w : null
  }
  const rank = (i: number): string | null => { const w = word(i); return w !== null ? RANKS[w] ?? null : null }
  const capture = (i: number): number | null => { const w = word(i); return w !== null && CAPTURE_WORDS.includes(w) ? i + 1 : null }

  const square = (i: number, allowLetter = false): Hit | null => {
    const f = file(i, allowLetter)
    const r = f ? rank(i + 1) : null
    return f && r ? { next: i + 2, san: f + r } : null
  }

  const longest = (hits: (Hit | null)[]): Hit | null =>
    hits.reduce<Hit | null>((best, h) => (h && (!best || h.next > best.next) ? h : best), null)

  // pezzo (colonna | traversa)? cattura? casa — la lettera semplice vale solo subito dopo il pezzo (RR-11)
  const pieceMove = (i: number): Hit | null => {
    const w = word(i)
    const p = w !== null ? PIECES[w] : undefined
    if (!p) return null
    const j = i + 1
    const target = (k: number, prefix: string, allowLetter: boolean): Hit | null => {
      const c = capture(k)
      const sq = square(c ?? k, allowLetter && c === null)
      return sq ? { next: sq.next, san: p + prefix + (c !== null ? 'x' : '') + sq.san } : null
    }
    const df = file(j, true)
    const dr = rank(j)
    return longest([
      target(j, '', true),
      df ? target(j + 1, df, false) : null,
      dr ? target(j + 1, dr, false) : null,
    ])
  }

  // pedone? (colonna cattura casa | casa) (promozione pezzo)?
  const pawnMove = (i: number): Hit | null => {
    const j = word(i) === PAWN_WORD ? i + 1 : i
    const f = file(j, false)
    const c = f ? capture(j + 1) : null
    const cap = c !== null ? square(c) : null
    const base = cap ? { next: cap.next, san: `${f}x${cap.san}` } : square(j)
    if (!base) return null
    const lastRank = base.san.slice(-1)
    const pr = lastRank === '1' || lastRank === '8' ? seq(base.next, PROMOTION_WORDS) : null
    const pw = pr !== null ? word(pr) : null
    const piece = pw !== null ? PIECES[pw] : undefined
    if (pr !== null && piece && piece !== 'K') return { next: pr + 1, san: `${base.san}=${piece}` }
    return base
  }

  const castle = (i: number): Hit | null => {
    const j = seq(i, CASTLE_WORDS)
    const side = j !== null ? word(j) : null
    const san = side !== null ? CASTLE_SIDES[side] : undefined
    const split = j !== null && san ? { next: j + 1, san } : null
    const fused = CASTLE_FUSED.map(([words, s]) => {
      const k = seq(i, [words])
      return k !== null ? { next: k, san: s } : null
    })
    return longest([split, ...fused, castleWithLead(i)])
  }

  // «EA Rocco lungo»: la «e» resta, «a Rocco lungo» diventa l'arrocco
  const castleWithLead = (i: number): Hit | null => {
    const w = word(i)
    const lead = w !== null ? CASTLE_LEADS[w] : undefined
    if (!lead || word(i + 1) !== 'rocco') return null
    const side = word(i + 2)
    const san = side !== null ? CASTLE_SIDES[side] : undefined
    return san ? { next: i + 3, san, lead } : null
  }

  const move = (i: number): Hit | null => {
    const m = castle(i) ?? pieceMove(i) ?? pawnMove(i)
    if (!m) return null
    for (const [words, sign] of CHECK_WORDS) {
      const k = seq(m.next, [words])
      if (k !== null) return { next: k, san: m.san + sign }
    }
    return m
  }

  // numero? mossa — il numero resta invariato se non lo segue una mossa (RR-8)
  const numberedMove = (i: number): Hit | null => {
    const w = word(i)
    const n = w !== null ? MOVE_NUMBERS[w] : undefined
    if (n !== undefined) {
      const m = move(i + 1)
      if (m && !m.lead) return { next: m.next, san: `${n}. ${m.san}` }
    }
    return move(i)
  }

  return { numberedMove }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Sostituzioni proposte, in ordine di posizione, una per mossa (con il suo numero) */
export function findDictatedMoves(text: string): DictatedReplacement[] {
  const toks = tokenize(text)
  const { numberedMove } = parser(toks)
  const out: DictatedReplacement[] = []
  let i = 0
  while (i < toks.length) {
    const hit = numberedMove(i)
    if (!hit) { i++; continue }
    const start = toks[i].start
    let end = toks[hit.next - 1].end
    let replacement = hit.san
    if (hit.lead) {
      // Maiuscola solo a inizio frase, come l'ha scritta la dettatura; altrimenti la congiunzione è minuscola
      const sentenceStart = /(^|[.!?]\s*)$/.test(text.slice(0, start))
      const lead = sentenceStart && text[start] === text[start].toUpperCase() ? hit.lead.toUpperCase() : hit.lead
      replacement = `${lead} ${replacement}`
    }
    const punct = DETACHED_PUNCT.exec(text.slice(end))
    if (punct) { end += punct[0].length; replacement += punct[1] }
    out.push({ start, end, original: text.slice(start, end), replacement })
    i = hit.next
  }
  return out
}

/** Applica le sostituzioni (dall'ultima alla prima) */
export function applyDictatedMoves(text: string, replacements: DictatedReplacement[]): string {
  let out = text
  for (const r of [...replacements].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, r.start) + r.replacement + out.slice(r.end)
  }
  return out
}
