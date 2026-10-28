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
import { computed } from 'vue'
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import { useChessBookStore } from '../stores/chessBookStore'
import { goToDiagram } from '../composables/useGoToDiagram'

const props = defineProps(nodeViewProps)
const store = useChessBookStore()

const info = computed(() => store.diagramLabels.get(props.node.attrs.targetId))
const label = computed(() => info.value?.label ?? '?')
const title = computed(() =>
  info.value
    ? `Ctrl+clic per andare al diagramma ${info.value.label}${info.value.caption ? ' — ' + info.value.caption : ''}`
    : 'Diagramma non trovato: il riferimento è orfano'
)

// Clic semplice = seleziona il riferimento (si può cancellare con Backspace); Ctrl/Cmd+clic = vai al diagramma
const onClick = (event: MouseEvent) => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    void goToDiagram(props.editor, props.node.attrs.targetId)
  }
}
</script>

<style scoped>
.diagram-ref { cursor: pointer; }
.diagram-ref.is-selected { outline: 2px solid var(--t-link-ring, #93c5fd); }
</style>