import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BINDING_MM, bindingMm, bindingPageCss, normalizeBinding } from '../src/utils/binding'
import { normalizeMetadata } from '../src/stores/book/types'
import { badgeReservePx, diagramFontPx, type DiagramSizeLevel } from '../src/utils/diagramSizes'
import { getPageSizeMm, MM_TO_PX } from '../src/utils/pageFormats'
import { columnWidthMm } from '../src/utils/twoColumns'

const LEVELS: DiagramSizeLevel[] = ['small', 'medium', 'large']
const BOARD_CHARS = 10

test('rilegatura: valori sconosciuti o assenti diventano «nessuna»', () => {
  assert.equal(normalizeBinding('left'), 'left')
  assert.equal(normalizeBinding('duplex'), 'duplex')
  assert.equal(normalizeBinding(undefined), 'none')
  assert.equal(normalizeBinding('spirale'), 'none')
})

test('rilegatura: un libro salvato prima della funzione si apre senza rilegatura', () => {
  assert.equal(normalizeMetadata({ title: 'Vecchio' }).binding, 'none')
  assert.equal(normalizeMetadata({ binding: 'duplex' }).binding, 'duplex')
})

test('rilegatura: spazio aggiunto al margine interno', () => {
  assert.equal(bindingMm('none'), 0)
  assert.equal(bindingMm('left'), BINDING_MM)
  assert.equal(bindingMm('duplex'), BINDING_MM)
})

test('rilegatura: solo il fronte/retro sposta lo spazio a destra nelle pagine pari', () => {
  assert.equal(bindingPageCss('none', 20, 20), '')
  assert.equal(bindingPageCss('left', 30, 20), '')
  // I margini ricevuti sono quelli delle pagine dispari, con la rilegatura già a sinistra
  const css = bindingPageCss('duplex', 30, 20)
  assert.match(css, /@page :left/)
  assert.match(css, /margin-left: 20mm/)
  assert.match(css, /margin-right: 30mm/)
})

for (const format of ['a4', 'crown-quarto', 'b-format']) {
  test(`rilegatura: in ${format} il diagramma più grande sta nella pagina`, () => {
    const textPx = (getPageSizeMm(format).width - 20 - BINDING_MM - 20) * MM_TO_PX
    const sizePx = diagramFontPx('large', format)
    assert.ok(badgeReservePx(sizePx, '12.34') + sizePx * BOARD_CHARS <= textPx)
  })
}

for (const format of ['a4', 'crown-quarto']) {
  test(`rilegatura: in ${format} a due colonne badge e scacchiera stanno nella colonna`, () => {
    const column = columnWidthMm(format, 20 + BINDING_MM, 20)
    for (const level of LEVELS) {
      const sizePx = diagramFontPx(level, format, column)
      assert.ok(badgeReservePx(sizePx, '12.34') + sizePx * BOARD_CHARS <= column * MM_TO_PX, level)
    }
  })
}
