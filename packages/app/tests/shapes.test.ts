import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanShapes, cycleMarkers, type BoardShape } from '../src/utils/shapes'
import { buildShapeItems } from '../src/utils/diagramShapes'

const circle = (orig: string, brush: BoardShape['brush'] = 'green'): BoardShape => ({ orig, brush })
const x = (orig: string, brush: BoardShape['brush'] = 'green'): BoardShape => ({ orig, brush, mark: 'x' })
const arrow: BoardShape = { orig: 'e2', dest: 'e4', brush: 'green' }

test('forme: la X si conserva, anche dalle forme di Chessground senza pennello', () => {
  assert.deepEqual(cleanShapes([x('d5', 'red')]), [x('d5', 'red')])
  assert.deepEqual(cleanShapes([{ orig: 'd5', mark: 'x', xBrush: 'red', customSvg: { html: '' } }]), [x('d5', 'red')])
  // Una freccia non può essere una X; una casa ha un solo marcatore
  assert.deepEqual(cleanShapes([{ ...arrow, mark: 'x' }]), [arrow])
  assert.deepEqual(cleanShapes([x('d5'), circle('d5')]), [x('d5')])
  // I libri salvati prima della X restano uguali
  assert.deepEqual(cleanShapes([circle('d5'), arrow]), [circle('d5'), arrow])
})

test('clic destro ripetuto: cerchio, poi X dello stesso colore, poi casa vuota', () => {
  // Secondo clic dello stesso colore: Chessground toglie il cerchio, l'app mette la X
  assert.deepEqual(cycleMarkers([arrow, circle('d5', 'red')], [arrow]), [arrow, x('d5', 'red')])
  // Terzo clic: Chessground sostituisce la X con un cerchio, l'app svuota la casa
  assert.deepEqual(cycleMarkers([arrow, x('d5', 'red')], [arrow, circle('d5')]), [arrow])
  // Primo clic e cambio di colore di un cerchio: come fa Chessground
  assert.deepEqual(cycleMarkers([arrow], [arrow, circle('d5')]), [arrow, circle('d5')])
  assert.deepEqual(cycleMarkers([circle('d5')], [circle('d5', 'red')]), [circle('d5', 'red')])
})

test('clic destro ripetuto: niente ciclo se cambiano più case insieme (Cancella frecce)', () => {
  const prev = [circle('d5'), circle('e4')]
  assert.deepEqual(cycleMarkers(prev, []), [])
  // Le frecce non entrano nel ciclo
  assert.deepEqual(cycleMarkers([arrow], []), [])
})

test('diagramma: la X è un tracciato con le due diagonali, nell’inchiostro del pennello', () => {
  const [item] = buildShapeItems([x('a8', 'red')], false)
  assert.equal(item.kind, 'x')
  if (item.kind !== 'x') return
  assert.equal(item.color, '#8a8a8a')
  // a8 senza inversione: centro (1.5, 1.5)
  assert.equal(item.d, 'M1.200,1.200 L1.800,1.800 M1.800,1.200 L1.200,1.800')
})
