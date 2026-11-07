// Numerazione delle pagine del PDF (pdf-core): gruppi di pagine, etichette e lato del numero
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findHeadingPages, findRefPages, matterClass, pageLabeler, pageNumberCss, toRoman } from '@mtc/pdf-core'

test('numeri romani minuscoli', () => {
  assert.deepEqual([1, 2, 3, 4, 9, 14, 40, 1999].map(toRoman), ['i', 'ii', 'iii', 'iv', 'ix', 'xiv', 'xl', 'mcmxcix'])
})

test('gruppi: copertina senza numero, pagine iniziali fino al primo capitolo, poi il corpo', () => {
  const book = ['cover', 'index', 'text', 'chapter', 'chapter', 'text'].map((type) => ({ type }))
  assert.deepEqual(book.map((_, i) => matterClass(book, i)),
    ['', 'front-matter', 'front-matter', 'body-matter body-start', 'body-matter', 'body-matter'])
  // Senza capitoli tutto è pagina iniziale
  const noChapters = ['index', 'text'].map((type) => ({ type }))
  assert.deepEqual(noChapters.map((_, i) => matterClass(noChapters, i)), ['front-matter', 'front-matter'])
})

test('etichette: romani dalla prima pagina iniziale, arabi da 1 dal corpo', () => {
  // Pagine: 1 copertina, 2-3 indice, 4 prefazione, 5-7 capitoli
  const texts = ['copertina', '[[FRONT]] Indice [[TOC0]]', 'segue indice', '[[TOC0]] Prefazione', '[[ BODY]] [[TOC1]] Capitolo', 'x', '[[TO\nC2]]']
  const label = pageLabeler(texts)
  assert.deepEqual([2, 3, 4, 5, 6, 7].map(label), ['i', 'ii', 'iii', '1', '2', '3'])
  assert.deepEqual([...findHeadingPages(texts)], [[0, 2], [1, 5], [2, 7]])
  // Partite citate negli indici: il marcatore può essere spezzato tra le righe del testo estratto
  assert.deepEqual([...findRefPages(['', '[[REF1]]', '[[RE\nF0]] [[REF1]]'])], [[1, 2], [0, 3]])
  // Capitolo esportato da solo: solo il corpo
  assert.deepEqual([1, 2].map(pageLabeler(['[[BODY]]', ''])), ['1', '2'])
})

test('numero al centro, oppure sul lato esterno con il fronte/retro', () => {
  const center = pageNumberCss()
  assert.match(center, /@page front \{ @bottom-center \{ content: counter\(prelim, lower-roman\)/)
  assert.match(center, /@page body \{ @bottom-center \{ content: counter\(corpo\)/)
  const outer = pageNumberCss({ outer: true })
  assert.doesNotMatch(outer, /bottom-center/)
  assert.match(outer, /@page body:right \{ @bottom-right/)
  assert.match(outer, /@page body:left \{ @bottom-left/)
  // La pagina bianca prima del corpo (fronte/retro) ha una pagina con nome propria, senza numero
  assert.match(outer, /\.blank-page \{ page: blank/)
  assert.doesNotMatch(outer, /@page blank/)
})
