import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { orderSections, withNewSection } from '../src/utils/sectionOrder'
import { useSectionDragDrop } from '../src/composables/useSectionDragDrop'
import type { SectionIndexItem } from '../src/stores/book/types'

const sec = (id: string, type: SectionIndexItem['type'] = 'chapter'): SectionIndexItem => ({ id, type, title: id })
const ids = (list: SectionIndexItem[]) => list.map((s) => s.id).join(' ')

test('ordine: copertina, indice, poi i capitoli nel loro ordine', () => {
  // Come i libri salvati con le versioni precedenti: indice in fondo
  const old = [sec('cop', 'cover'), sec('c1'), sec('c2'), sec('c3'), sec('ind', 'index')]
  assert.equal(ids(orderSections(old)), 'cop ind c1 c2 c3')
  assert.equal(ids(orderSections([sec('c1'), sec('ind', 'index'), sec('c2'), sec('cop', 'cover')])), 'cop ind c1 c2')
  assert.equal(ids(orderSections([sec('c2'), sec('c1')])), 'c2 c1')
})

const drag = (from: number, to: number) => {
  const list = ref([sec('cop', 'cover'), sec('ind', 'index'), sec('c1'), sec('c2'), sec('c3')])
  const dnd = useSectionDragDrop(list, ref(false))
  dnd.onDragStart(from)
  dnd.onDrop(to)
  return ids(list.value)
}

test('trascinamento: tra i capitoli', () => {
  assert.equal(drag(2, 4), 'cop ind c2 c3 c1')
  assert.equal(drag(4, 2), 'cop ind c3 c1 c2')
})

test('trascinamento: sulla copertina o sull’indice il capitolo diventa il primo', () => {
  assert.equal(drag(4, 1), 'cop ind c3 c1 c2')
  assert.equal(drag(3, 0), 'cop ind c2 c1 c3')
})

test('trascinamento: copertina e indice non si spostano', () => {
  assert.equal(drag(1, 4), 'cop ind c1 c2 c3')
  assert.equal(drag(0, 3), 'cop ind c1 c2 c3')
})

// Libro con sezioni senza numero: p1 p2 in testa, b1 b2 in fondo
const book = () => [sec('cop', 'cover'), sec('ind', 'index'), sec('p1', 'text'), sec('p2', 'text'),
  sec('c1'), sec('c2'), sec('b1', 'text'), sec('b2', 'text')]
const dragBook = (from: string, to: string) => {
  const list = ref(book())
  const dnd = useSectionDragDrop(list, ref(false))
  dnd.onDragStart(list.value.findIndex((s) => s.id === from))
  dnd.onDrop(list.value.findIndex((s) => s.id === to))
  return ids(list.value)
}

test('sezioni senza numero: restano in testa o in fondo secondo la posizione', () => {
  assert.equal(ids(orderSections(book())), 'cop ind p1 p2 c1 c2 b1 b2')
  // Senza capitoli stanno tutte in testa
  assert.equal(ids(orderSections([sec('t1', 'text'), sec('ind', 'index')])), 'ind t1')
})

test('sezioni senza numero: le nuove vanno in fondo al gruppo scelto', () => {
  assert.equal(ids(withNewSection(book(), sec('n', 'text'), 'front')), 'cop ind p1 p2 n c1 c2 b1 b2')
  assert.equal(ids(withNewSection(book(), sec('n', 'text'), 'back')), 'cop ind p1 p2 c1 c2 b1 b2 n')
  assert.equal(ids(withNewSection(book(), sec('c3'))), 'cop ind p1 p2 c1 c2 c3 b1 b2')
  assert.equal(ids(withNewSection([sec('c1')], sec('ind', 'index'))), 'ind c1')
})

test('sezioni senza numero: si riordinano nel proprio gruppo', () => {
  assert.equal(dragBook('p1', 'p2'), 'cop ind p2 p1 c1 c2 b1 b2')
  assert.equal(dragBook('b2', 'b1'), 'cop ind p1 p2 c1 c2 b2 b1')
})

test('sezioni senza numero: passano dalla testa al fondo e viceversa', () => {
  assert.equal(dragBook('p1', 'b1'), 'cop ind p2 c1 c2 b1 p1 b2')
  assert.equal(dragBook('b2', 'p1'), 'cop ind b2 p1 p2 c1 c2 b1')
  // Sull'ultimo capitolo, scendendo: prima delle sezioni finali
  assert.equal(dragBook('p2', 'c2'), 'cop ind p1 c1 c2 p2 b1 b2')
  // Sul primo capitolo, salendo: ultima delle sezioni iniziali
  assert.equal(dragBook('b1', 'c1'), 'cop ind p1 p2 b1 c1 c2 b2')
  // Sull'indice: prima delle sezioni iniziali
  assert.equal(dragBook('b2', 'ind'), 'cop ind b2 p1 p2 c1 c2 b1')
})

test('sezioni senza numero e capitoli non si mescolano', () => {
  assert.equal(dragBook('p1', 'c1'), 'cop ind p1 p2 c1 c2 b1 b2')     // scendendo sul primo capitolo: resta
  assert.equal(dragBook('c1', 'p1'), 'cop ind p1 p2 c1 c2 b1 b2')
  assert.equal(dragBook('c2', 'b1'), 'cop ind p1 p2 c1 c2 b1 b2')
  assert.equal(dragBook('c2', 'ind'), 'cop ind p1 p2 c2 c1 b1 b2')
})
