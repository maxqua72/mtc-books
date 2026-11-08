import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addMove, buildLineTree, formatLine, lineTokens, removeMove, mainLineSans, mergeImportedNotes, noteStats, notePreview, notesFileName,
  notesToPackage, packageToNotes, prepareNoteForBook, stripLeadingHeading, UNTITLED_NOTE, type Note,
} from '../src/notebook/notesModel'
import { buildMtcBook, parseMtcBook } from '../src/stores/book/mtcbookIO'
import { STANDARD_FEN } from '../src/utils/fen'
import { extractTreeIds } from '../src/utils/html'

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'

function sampleNote(): Note {
  const tree = buildLineTree(STANDARD_FEN, ['e4', 'c5', 'Nf3'], 'Siciliana')
  return {
    id: 'note-abc123',
    title: 'Siciliana, idea',
    html: `<p>Dopo 1. e4 c5</p><div data-id="dg_1" fen="${AFTER_E4}" data-type="chess-diagram" class="chess-diagram-container"><div class="diagram-card"><pre class="chess-pure-text">x</pre><div class="diagram-caption"></div></div></div>`
      + `<div tree-id="${tree.id}" data-tree-id="${tree.id}" data-type="chess-tree-block"></div>`,
    trees: [tree],
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-02T10:00:00.000Z',
  }
}

test('linea di mosse: si ferma alla prima mossa illegale', () => {
  const tree = buildLineTree(STANDARD_FEN, ['e4', 'e5', 'Ke3', 'Nf3'])
  assert.deepEqual(mainLineSans(tree), ['e4', 'e5'])
  assert.equal(tree.rootNodes[0].children[0].parentId, tree.rootNodes[0].id)
  assert.equal(formatLine(tree), '1. e4 e5')
})

test('linea che parte con il Nero', () => {
  const tree = buildLineTree(AFTER_E4, ['c5', 'Nf3'])
  assert.equal(formatLine(tree), '1... c5 2. Nf3')
})

test('varianti: una mossa diversa apre una variante, la stessa mossa si riusa', () => {
  const tree = buildLineTree(STANDARD_FEN, ['e4', 'e5', 'Nf3'])
  const e4 = tree.rootNodes[0]
  assert.equal(addMove(tree.rootNodes, STANDARD_FEN, e4.id, 'e5'), e4.children[0])
  const c5 = addMove(tree.rootNodes, STANDARD_FEN, e4.id, 'c5')!
  addMove(tree.rootNodes, STANDARD_FEN, c5.id, 'Nf3')
  const d4 = addMove(tree.rootNodes, STANDARD_FEN, null, 'd4')!
  assert.equal(d4.parentId, null)
  assert.equal(addMove(tree.rootNodes, STANDARD_FEN, e4.id, 'Ke7'), null)
  assert.equal(formatLine(tree), '1. e4 (1. d4) 1... e5 (1... c5 2. Nf3) 2. Nf3')
  assert.deepEqual(lineTokens(tree.rootNodes).map(t => t.depth), [0, 1, 1, 1, 0, 1, 1, 1, 1, 0])
  assert.deepEqual(mainLineSans(tree), ['e4', 'e5', 'Nf3'])
  assert.equal(removeMove(tree.rootNodes, c5.id), e4.id)
  assert.equal(formatLine(tree), '1. e4 (1. d4) 1... e5 2. Nf3')
})

test('statistiche e anteprima ignorano scacchiere e tag', () => {
  const note = sampleNote()
  assert.deepEqual(noteStats(note), { diagrams: 1, lines: 1 })
  assert.equal(notePreview(note), 'Dopo 1. e4 c5')
  assert.equal(notePreview({ html: `<p>${'a'.repeat(200)}</p>` }, 10).length, 10)
})

test('appunti -> .mtcbook -> appunti', async () => {
  const note = sampleNote()
  const untitled: Note = { ...sampleNote(), id: 'note-xyz', title: '  ', trees: [], html: '<p>vuoto</p>' }
  const blob = await buildMtcBook(notesToPackage([note, untitled]))
  const pkg = await parseMtcBook(await blob.arrayBuffer())

  assert.equal(pkg.metadata.title, 'Appunti dal Taccuino')
  assert.deepEqual(pkg.sectionIndex.map(s => s.title), ['Siciliana, idea', UNTITLED_NOTE])
  assert.match(JSON.parse(pkg.sections['note-abc123']).html, /^<h2>Siciliana, idea<\/h2>/)

  const back = packageToNotes(pkg)
  assert.equal(back.length, 2)
  assert.equal(back[0].id, note.id)
  assert.equal(back[0].title, note.title)
  assert.equal(back[0].html, note.html)
  assert.deepEqual(back[0].trees, note.trees)
  assert.equal(back[1].title, '')   // il titolo segnaposto non diventa un titolo vero
})

test('solo il primo titolo viene tolto', () => {
  assert.equal(stripLeadingHeading('<h2>A</h2><p>x</p><h2>B</h2>'), '<p>x</p><h2>B</h2>')
  assert.equal(stripLeadingHeading('<p>x</p>'), '<p>x</p>')
})

test('importare di nuovo lo stesso file aggiorna senza duplicare', () => {
  const old: Note = { ...sampleNote(), insertedIn: [{ bookId: 'bk_1', title: 'Libro', at: '2026-11-03' }] }
  const incoming: Note[] = [
    { ...sampleNote(), html: '<p>nuovo</p>', createdAt: '2026-11-09T00:00:00.000Z' },
    { ...sampleNote(), id: 'note-new' },
  ]
  const { notes, added, updated } = mergeImportedNotes([old], incoming)
  assert.equal(added, 1)
  assert.equal(updated, 1)
  assert.equal(notes[0].html, '<p>nuovo</p>')
  assert.equal(notes[0].createdAt, old.createdAt)
  assert.deepEqual(notes[0].insertedIn, old.insertedIn)
})

test('inserimento nel libro: alberi con id nuovi, diagrammi senza id', () => {
  const note = sampleNote()
  const orphan = buildLineTree(STANDARD_FEN, ['d4'])
  const first = prepareNoteForBook({ ...note, trees: [...note.trees, orphan] })
  const second = prepareNoteForBook(note)

  assert.equal(first.trees.length, 1)   // l'albero non usato dal testo si scarta
  assert.notEqual(first.trees[0].id, note.trees[0].id)
  assert.notEqual(first.trees[0].id, second.trees[0].id)
  assert.deepEqual(extractTreeIds(first.html), [first.trees[0].id])
  assert.ok(first.html.includes(`tree-id="${first.trees[0].id}" data-tree-id="${first.trees[0].id}"`))
  assert.doesNotMatch(first.html, /data-id="dg_1"/)
  assert.match(first.html, /data-type="chess-diagram"/)
  assert.deepEqual(mainLineSans(first.trees[0]), ['e4', 'c5', 'Nf3'])
  assert.match(note.html, /data-id="dg_1"/)   // l'appunto originale non cambia
})

test('nome del file condiviso', () => {
  assert.equal(notesFileName(new Date(2026, 10, 8)), 'appunti-2026-11-08.mtcbook')
})
