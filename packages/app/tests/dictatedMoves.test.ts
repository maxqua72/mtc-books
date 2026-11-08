import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyDictatedMoves, findDictatedMoves } from '../src/utils/dictatedMoves'
import { findPieceLetters } from '../src/utils/figurines'

const convert = (text: string) => applyDictatedMoves(text, findDictatedMoves(text))

const T1_IN = 'Dopo uno Empoli quattro Empoli 5 2 cavallo Firenze tre il nero gioca cavallo Como sei poi alfiere Bologna 5 e infine a Rocco corto'
const T1_OUT = 'Dopo 1. e4 e5 2. Nf3 il nero gioca Nc6 poi Bb5 e infine O-O'

test('T-1: caso reale della dettatura', () => {
  assert.equal(convert(T1_IN), T1_OUT)
})

test('T-1: sostituzioni con indici e testo originale', () => {
  const r = findDictatedMoves(T1_IN)
  assert.deepEqual(r.map(x => x.replacement), ['1. e4', 'e5', '2. Nf3', 'Nc6', 'Bb5', 'O-O'])
  for (const x of r) assert.equal(T1_IN.slice(x.start, x.end), x.original)
  assert.equal(r[0].original, 'uno Empoli quattro')
  assert.equal(r[5].original, 'a Rocco corto')
})

test('RR-1: mossa di pedone, con e senza «pedone»', () => {
  assert.equal(convert('Empoli quattro'), 'e4')
  assert.equal(convert('pedone Empoli quattro'), 'e4')
  assert.equal(convert('gioca Hotel 3'), 'gioca h3')
})

test('RR-2: mossa di pezzo', () => {
  assert.equal(convert('cavallo Firenze tre'), 'Nf3')
  assert.equal(convert('re Genova uno'), 'Kg1')
  assert.equal(convert('regina Hotel cinque'), 'Qh5')
  assert.equal(convert('torre Domodossola 1'), 'Rd1')
})

test('RR-3: catture di pezzo e di pedone', () => {
  assert.equal(convert('donna prende Empoli cinque'), 'Qxe5')
  assert.equal(convert('alfiere per Como 6'), 'Bxc6')
  assert.equal(convert('cavallo mangia Domodossola 4'), 'Nxd4')
  assert.equal(convert('torre cattura Ancona 7'), 'Rxa7')
  assert.equal(convert('Empoli prende Domodossola cinque'), 'exd5')
})

test('RR-4: disambiguazione per colonna o traversa, anche con cattura', () => {
  assert.equal(convert('cavallo Bologna Domodossola sette'), 'Nbd7')
  assert.equal(convert('torre uno Empoli uno'), 'R1e1')
  assert.equal(convert('cavallo Bologna prende Domodossola 7'), 'Nbxd7')
  assert.equal(convert('torre 8 per Ancona 2'), 'R8xa2')
})

test('RR-5: promozione, anche con cattura', () => {
  assert.equal(convert('Empoli otto promuove a donna'), 'e8=Q')
  assert.equal(convert('Empoli prende Domodossola 8 uguale cavallo'), 'exd8=N')
  assert.equal(convert('Ancona 1 promozione in torre'), 'a1=R')
  assert.equal(convert('Bologna 8 promuove alfiere'), 'b8=B')
})

test('RR-5: niente promozione fuori dall\'ultima traversa', () => {
  assert.equal(convert('Empoli 4 uguale donna'), 'e4 uguale donna')
})

test('RR-6: scacco e matto', () => {
  assert.equal(convert('alfiere Bologna 5 scacco'), 'Bb5+')
  assert.equal(convert('donna Hotel sette matto'), 'Qh7#')
  assert.equal(convert('donna Hotel sette scacco matto'), 'Qh7#')
})

test('RR-7: arrocchi con le varianti di trascrizione', () => {
  for (const s of ['a Rocco corto', 'a rocco cotto', 'arroco corto', 'arrocco corta']) assert.equal(convert(s), 'O-O', s)
  for (const s of ['arrocco lungo', 'a rocco lunga']) assert.equal(convert(s), 'O-O-O', s)
  assert.equal(convert('arrocco corto scacco'), 'O-O+')
  assert.equal(convert('arrocco lungo matto'), 'O-O-O#')
})

test('RR-7: arrocchi con le parole fuse dalla dettatura', () => {
  for (const s of ['roccolgo', 'a Roccolgo', 'arroccolungo', 'Arrocolungo', 'a rocco lungo']) assert.equal(convert(s), 'O-O-O', s)
  for (const s of ['roccocorto', 'a roccocorto', 'arroccocorto', 'roccocotto']) assert.equal(convert(s), 'O-O', s)
  assert.equal(convert('Alla mossa 12 a Roccolgo e alla 13 re Bologna uno'), 'Alla mossa 12. O-O-O e alla 13. Kb1')
})

test('RR-2: il re', () => {
  assert.equal(convert('re Bologna uno'), 'Kb1')
  assert.equal(convert('13 re Bologna uno'), '13. Kb1')
  assert.equal(convert('re prende Genova due scacco'), 'Kxg2+')
  for (const s of ['il re è al sicuro', 're e donna']) assert.equal(convert(s), s)
})

test('RR-8: numero di mossa in cifre e in parole', () => {
  assert.equal(convert('uno Empoli quattro'), '1. e4')
  assert.equal(convert('2 cavallo Firenze tre'), '2. Nf3')
  assert.equal(convert('ventuno torre Domodossola 1'), '21. Rd1')
  assert.equal(convert('trenta re Firenze 2'), '30. Kf2')
  assert.equal(convert('diciotto arrocco corto'), '18. O-O')
})

test('RR-8: un numero non seguito da una mossa resta invariato', () => {
  assert.equal(convert('nel 1972 vinse'), 'nel 1972 vinse')
  assert.equal(convert('le 3 partite'), 'le 3 partite')
})

test('RR-9: notazione compatibile con le figurine e testo intermedio invariato', () => {
  assert.equal(convert('il bianco gioca cavallo Firenze tre e poi alfiere Como 4'), 'il bianco gioca Nf3 e poi Bc4')
})

test('RR-9: le lettere dei pezzi diventano figurine (MOVE_RE)', () => {
  const out = convert('cavallo Bologna prende Domodossola 7 poi Empoli prende Domodossola 8 uguale cavallo e donna Hotel sette matto')
  assert.equal(out, 'Nbxd7 poi exd8=N e Qh7#')
  assert.deepEqual(findPieceLetters(out).map(p => p.letter), ['N', 'N', 'Q'])
})

test('RR-10: maiuscole e punteggiatura', () => {
  assert.equal(convert('CAVALLO firenze TRE'), 'Nf3')
  assert.equal(convert('cavallo, Firenze tre'), 'Nf3')
  assert.equal(convert('Infine arrocco corto.'), 'Infine O-O.')
  assert.equal(convert('Gioca alfiere Bologna 5, poi'), 'Gioca Bb5, poi')
  assert.equal(convert('(Empoli quattro)'), '(e4)')
  assert.equal(convert('Uno. Empoli, quattro!'), '1. e4!')
})

test('RR-10: punto staccato dopo una mossa', () => {
  assert.equal(convert('Uno Empoli 4 Empoli 5 .'), '1. e4 e5.')
  assert.equal(convert('cavallo Firenze tre , poi'), 'Nf3, poi')
  assert.equal(convert('arrocco corto ; poi'), 'O-O; poi')
  assert.equal(convert('alfiere Bologna 5 : il'), 'Bb5: il')
  // ! e ? sono segni di valutazione; la punteggiatura che non segue una mossa resta com'è
  assert.equal(convert('cavallo Firenze tre !'), 'Nf3 !')
  assert.equal(convert('Empoli 4 ?'), 'e4 ?')
  assert.equal(convert('il nero gioca .'), 'il nero gioca .')
  assert.equal(convert('1. e4 .'), '1. e4 .')
})

test('RR-11: lettera semplice come colonna solo subito dopo il pezzo', () => {
  assert.equal(convert('cavallo F tre'), 'Nf3')
  assert.equal(convert('cavallo b Domodossola 7'), 'Nbd7')
  assert.equal(convert('alfiere prende E cinque'), 'alfiere prende E cinque')
})

test('RN-1: pezzo non seguito da una casa', () => {
  for (const s of ['la donna è il pezzo più forte', 'il cavallo in c6 è debole']) assert.equal(convert(s), s)
})

test('RN-2: città non seguita da una traversa', () => {
  const s = 'nel 1950 a Firenze'
  assert.equal(convert(s), s)
})

test('RN-3 / T-4: testo già in notazione invariato, comando idempotente', () => {
  assert.deepEqual(findDictatedMoves('1. e4 e5 2. Nf3 Nc6 3. O-O'), [])
  assert.deepEqual(findDictatedMoves(T1_OUT), [])
  assert.equal(convert(convert(T1_IN)), T1_OUT)
})

test('RN-4: forme senza città fuori da RR-11', () => {
  for (const s of ['C sei', 'e quattro', 'alfieri più 5']) assert.equal(convert(s), s)
})

test('RF-5: una mossa non attraversa un nodo inline', () => {
  assert.equal(convert('cavallo ￼ Firenze tre'), 'cavallo ￼ f3')
  assert.equal(convert('cavallo Firenze￼ tre'), 'cavallo Firenze￼ tre')
})
