import { test } from 'node:test'
import assert from 'node:assert/strict'
import { badgeReservePx, diagramFontPx, type DiagramSizeLevel } from '../src/utils/diagramSizes'
import { MM_TO_PX } from '../src/utils/pageFormats'
import { columnWidthMm, twoColumnsAvailable } from '../src/utils/twoColumns'

const LEVELS: DiagramSizeLevel[] = ['small', 'medium', 'large']
const BOARD_CHARS = 10

test('due colonne: B-Format è escluso', () => {
  assert.equal(twoColumnsAvailable('a4'), true)
  assert.equal(twoColumnsAvailable('crown-quarto'), true)
  assert.equal(twoColumnsAvailable(undefined), true)
  assert.equal(twoColumnsAvailable('b-format'), false)
})

test('due colonne: larghezza della colonna con i margini predefiniti', () => {
  assert.equal(columnWidthMm('a4', 20, 20), 81)
  assert.equal(columnWidthMm('crown-quarto', 20, 20), 70.5)
})

for (const format of ['a4', 'crown-quarto']) {
  test(`due colonne: in ${format} badge e scacchiera stanno nella colonna, a ogni dimensione`, () => {
    const columnPx = columnWidthMm(format, 20, 20) * MM_TO_PX
    for (const level of LEVELS) {
      const sizePx = diagramFontPx(level, format, columnWidthMm(format, 20, 20))
      assert.ok(badgeReservePx(sizePx, '12.34') + sizePx * BOARD_CHARS <= columnPx, level)
    }
  })

  test(`due colonne: in ${format} le tre dimensioni restano distinte e non superano quelle del formato`, () => {
    const column = columnWidthMm(format, 20, 20)
    const [small, medium, large] = LEVELS.map(level => diagramFontPx(level, format, column))
    assert.ok(small < medium && medium < large)
    for (const level of LEVELS) assert.ok(diagramFontPx(level, format, column) <= diagramFontPx(level, format))
  })
}

test('colonna unica: le misure dei diagrammi non cambiano', () => {
  assert.equal(diagramFontPx('medium', 'a4'), Math.round(((42 / 8) * MM_TO_PX) * 100) / 100)
})
