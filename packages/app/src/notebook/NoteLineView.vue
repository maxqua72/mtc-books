<template>
  <!-- Linea di mosse nel Taccuino: le mosse con le varianti fra parentesi, da toccare per modificarle -->
  <node-view-wrapper class="note-line" contenteditable="false" role="button"
    aria-label="Linea di mosse: tocca per modificarla" @click="edit">
    <i class="fa-solid fa-chess-pawn note-line-icon" aria-hidden="true"></i>
    <span v-if="html" class="note-line-moves" v-html="html"></span>
    <span v-else class="note-line-empty">Linea vuota</span>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { figurinizeHtml } from '../utils/figurines'
import { escapeHtml } from '../utils/html'

import { EDIT_NODE_EVENT, lineTokens } from './notesModel'

const props = defineProps(nodeViewProps)
const treeStore = useChessTreeStore()

const tree = computed(() => treeStore.trees.find(t => t.id === props.node.attrs.treeId))
// Linea principale in grassetto, varianti in tondo
const html = computed(() => {
  if (!tree.value) return ''
  let out = ''
  let prev: string | null = null
  for (const t of lineTokens(tree.value.rootNodes)) {
    const glue = prev === null || prev === 'open' || t.kind === 'close' ? '' : ' '
    const text = t.kind === 'move' ? figurinizeHtml(escapeHtml(t.text)) : t.kind === 'open' ? '(' : ')'
    out += glue + (t.depth ? `<span class="var">${text}</span>` : text)
    prev = t.kind
  }
  return out
})

const edit = () => {
  const pos = props.getPos()
  if (typeof pos === 'number') window.dispatchEvent(new CustomEvent(EDIT_NODE_EVENT, { detail: { pos } }))
}
</script>

<style scoped>
.note-line {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0.5rem 0;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: #f5f5f4;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.note-line:active { background: #e7e5e4; }
.note-line-icon { font-size: 0.8em; color: #78716c; }
.note-line-empty { color: #a8a29e; font-weight: 400; }
.note-line-moves :deep(.var) { font-weight: 400; color: #57534e; }
.note-line-moves :deep(.tgc-figurine) {
  font-family: 'Chess The Good Companions', sans-serif;
  font-weight: normal;
  font-size: 1.05em;
  line-height: 1;
  margin-right: 1px;
  vertical-align: 1px;
}
.note-line-moves :deep(.chess-cases-figurine) {
  font-family: 'Chess Cases', sans-serif;
  font-weight: normal;
  font-size: 1.15em;
  line-height: 1;
  vertical-align: -3px;
}
</style>
