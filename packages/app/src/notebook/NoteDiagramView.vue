<template>
  <!-- Diagramma nel Taccuino: miniatura da toccare per modificarlo -->
  <node-view-wrapper class="note-diagram" contenteditable="false" role="button"
    aria-label="Diagramma: tocca per modificarlo" @click="edit">
    <div class="note-diagram-board">
      <span class="note-turn" :class="turn" :title="turn === 'black' ? 'Mossa al Nero' : 'Mossa al Bianco'"></span>
      <pre class="note-board-text">{{ board }}</pre>
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import { fenToBoardString } from '../utils/chessFormatter'
import { EDIT_NODE_EVENT } from './notesModel'

const props = defineProps(nodeViewProps)

const board = computed(() => fenToBoardString(props.node.attrs.fen, !!props.node.attrs.flipped))
const turn = computed(() => (String(props.node.attrs.fen).trim().split(/\s+/)[1] === 'b' ? 'black' : 'white'))

const edit = () => {
  const pos = props.getPos()
  if (typeof pos === 'number') window.dispatchEvent(new CustomEvent(EDIT_NODE_EVENT, { detail: { pos } }))
}
</script>

<style scoped>
.note-diagram {
  display: flex;
  justify-content: center;
  margin: 0.75rem 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.note-diagram-board {
  position: relative;
  padding-left: 14px;
}
.note-board-text {
  font-family: 'Chess Merida', serif;
  font-size: min(22px, 5.6vw);
  line-height: 1;
  margin: 0;
  white-space: pre;
  color: #111;
}
.note-turn {
  position: absolute;
  left: 0;
  bottom: 0.4em;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid #111;
}
.note-turn.white { background: #fff; }
.note-turn.black { background: #111; }
.note-diagram:active .note-diagram-board { opacity: 0.6; }
</style>
