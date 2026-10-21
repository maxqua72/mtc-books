<template>
  <node-view-wrapper
    as="span"
    class="diagram-ref"
    :class="{ 'is-broken': !info, 'is-selected': selected }"
    :title="title"
    @click="onClick"
  >{{ label }}</node-view-wrapper>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import { useChessBookStore } from '../stores/chessBookStore'

const props = defineProps(nodeViewProps)
const store = useChessBookStore()

const info = computed(() => store.diagramLabels.get(props.node.attrs.targetId))
const label = computed(() => info.value?.label ?? '?')
const title = computed(() =>
  info.value
    ? `Ctrl+clic per andare al diagramma ${info.value.label}${info.value.caption ? ' — ' + info.value.caption : ''}`
    : 'Diagramma non trovato: il riferimento è orfano'
)

const raf = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

const findDiagramPos = (id: string): number | null => {
  let found: number | null = null
  props.editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false
    if (node.type.name === 'chessDiagram' && node.attrs.id === id) {
      found = pos
      return false
    }
  })
  return found
}

const goToDiagram = async () => {
  const target = info.value
  if (!target) return
  const id = props.node.attrs.targetId as string

  // Se il diagramma è in un altro capitolo: congela quello attuale e cambia sezione
  if (store.activeSectionId !== target.sectionId) {
    window.dispatchEvent(new CustomEvent('request-editor-sync'))
    await store.changeActiveSection(target.sectionId, store.activeSectionHtml)
    await nextTick()
    await raf()
    await raf()
  }

  const pos = findDiagramPos(id)
  if (pos === null) return
  const dom = props.editor.view.nodeDOM(pos) as HTMLElement | null
  if (!dom) return

  dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
  dom.classList.add('diagram-flash')
  setTimeout(() => dom.classList.remove('diagram-flash'), 1600)
}

// Clic semplice = seleziona il riferimento (si può cancellare con Backspace); Ctrl/Cmd+clic = vai al diagramma
const onClick = (event: MouseEvent) => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    goToDiagram()
  }
}
</script>

<style scoped>
.diagram-ref {
  color: var(--t-link, #1d4ed8);
  font-weight: 500;
  cursor: pointer;
  padding: 0 1px;
  border-radius: 2px;
}
.diagram-ref:hover {
  background-color: var(--t-link-soft, #eff6ff);
}
.diagram-ref.is-selected {
  outline: 2px solid var(--t-link-ring, #93c5fd);
}
.diagram-ref.is-broken {
  color: #dc2626;
  background-color: #fef2f2;
}
</style>