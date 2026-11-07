import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { orderSections } from '../src/utils/sectionOrder'
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
