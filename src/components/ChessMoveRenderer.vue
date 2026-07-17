<template>
  <div class="chess-tree-render-container" :class="isVariantRoot ? 'is-variant-inline' : 'is-main-line'">
    <template v-for="(node, index) in nodes" :key="node.id">
      <!-- Contenitore della mossa singola -->
      <span class="chess-move-item" :class="{
        'is-active': isNodeActive(node.id),
        'is-main-move': !isVariantRoot
      }" @click="selectMove(node.id)">
        <span class="move-prefix">{{ getMovePrefix(node, index) }}</span>
        <span class="move-san">{{ node.san }}</span>
      </span>

      <!-- Render del commento se presente -->
      <div v-if="node.comment" class="move-comment-box" :class="isVariantRoot ? 'comment-inline' : 'comment-block'"
        @click="activateThisTree">
        <span class="comment-bracket">{</span>
        <!-- 
          🔥 SOLUZIONE: Usiamo v-once. 
          In questo modo Vue inserisce il testo iniziale nel DOM una volta sola.
          I tasti successivi vengono gestiti interamente dal browser senza interferenze o inversioni.
        -->
        <span 
          contenteditable="true" 
          class="comment-editable-text"
          v-once
          @input="onCommentInput(node.id, $event)"
          @keydown.enter.prevent
          @keydown.stop
        >{{ node.comment }}</span>
        <span class="comment-bracket">}</span>
      </div>

      <!-- Input vuoto persistente per la mossa attiva -->
      <div v-else-if="isNodeActive(node.id)" class="move-comment-box is-empty"
        :class="isVariantRoot ? 'comment-inline' : 'comment-block'" @click="activateThisTree">
        <span class="comment-bracket">{</span>
        <span 
          contenteditable="true" 
          class="comment-editable-text"
          data-placeholder="Aggiungi commento..."
          @input="onCommentInput(node.id, $event)"
          @keydown.enter.prevent
          @keydown.stop
        ></span>
        <span class="comment-bracket">}</span>
      </div>

      <!-- Gestione Ricorsiva delle Varianti -->
      <template v-if="node.children && node.children.length > 1">
        <span class="variant-wrapper" :class="{ 'break-main-line': !isVariantRoot }">
          <template v-for="(subTree, subIdx) in node.children.slice(1)" :key="subTree.id">
            <span class="bracket">(</span>
            <ChessMoveRenderer :nodes="[subTree]" :is-variant-root="true" :tree-id="treeId" />
            <span class="bracket">)</span>
          </template>
        </span>
      </template>

      <!-- Prosecuzione sulla linea principale -->
      <ChessMoveRenderer v-if="node.children && node.children.length > 0" :nodes="[node.children[0]]"
        :is-variant-root="isVariantRoot" :tree-id="treeId" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useChessTreeStore } from '../stores/chessTreeStore'
import type { ChessMoveNode } from '../stores/chessTreeStore'
import { computed } from 'vue'

const props = defineProps<{
  nodes: ChessMoveNode[]
  isVariantRoot?: boolean
  treeId: string
}>()

const treeStore = useChessTreeStore()

const myTree = computed(() => {
  return treeStore.trees.find(t => t.id === props.treeId)
})

const isNodeActive = (nodeId: string) => {
  return treeStore.activeTreeId === props.treeId && treeStore.activeNodeId === nodeId
}

const selectMove = (nodeId: string) => {
  if (treeStore.activeTreeId !== props.treeId) {
    treeStore.activeTreeId = props.treeId
  }
  treeStore.setActiveNode(nodeId)
}

const activateThisTree = () => {
  if (treeStore.activeTreeId !== props.treeId) {
    treeStore.activeTreeId = props.treeId
    const targetNodeId = myTree.value?.activeNodeId || null
    treeStore.setActiveNode(targetNodeId)
  }
}

// SOLUZIONE DEL CURSORE BLOCCATO:
// Aggiorna lo store di Pinia in silenzio senza forzare Vue a riscrivere il DOM sotto il cursore
const onCommentInput = (nodeId: string, event: Event) => {
  activateThisTree()
  const target = event.target as HTMLElement
  
  // Usiamo textContent o innerText per estrarre la stringa digitata in tempo reale
  const currentText = target.textContent || ''

  const targetNode = treeStore.findNodeById(myTree.value?.rootNodes || [], nodeId)
  if (targetNode) {
    targetNode.comment = currentText.trim() === '' ? null : currentText
  }
}

const getMovePrefix = (node: ChessMoveNode, index: number): string => {
  if (node.color === 'w') {
    return `${node.moveNumber}. `
  }
  if (props.isVariantRoot && index === 0) {
    return `${node.moveNumber}... `
  }
  const parentNode = treeStore.findNodeById(myTree.value?.rootNodes || [], node.parentId || '')
  if (parentNode && parentNode.comment !== null) {
    return `${node.moveNumber}... `
  }
  return ''
}
</script>

<style scoped>
/* Lascia immutati i tuoi stili correnti del renderer... */
.is-main-line, .is-variant-inline {
  display: inline;
}
.chess-move-item {
  padding: 2px 4px;
  margin-right: 4px;
  cursor: pointer;
  border-radius: 4px;
  background: #f3f4f6;
  display: inline-block;
}
.chess-move-item.is-main-move {
  font-weight: bold;
  color: #111827;
  background: #e5e7eb;
}
.chess-move-item.is-active {
  background: #3b82f6;
  color: #fff !important;
}
.move-comment-box {
  color: #111827; 
  margin: 0 4px;
  display: inline;
}
.comment-block {
  display: block;
  margin: 6px 0 6px 20px; 
}
.comment-inline {
  display: inline;
}

/* STILE LIBRO PERFETTO: Rimuove qualsiasi traccia visiva di caselle */
.comment-editable-text {
  display: inline;
  font-family: inherit;
  font-size: inherit;
  font-style: normal; 
  outline: none;
  min-width: 4px;
  border: none;
  padding: 0;
  background: transparent;
}

.comment-editable-text:empty::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  font-style: italic;
}
.comment-bracket {
  font-weight: bold;
  color: #9ca3af;
}
.variant-wrapper {
  color: #6b7280;
  font-weight: normal;
  display: inline;
}
.variant-wrapper.break-main-line {
  display: block;
  margin: 6px 0 6px 20px;
  font-size: 0.95rem; 
}
.bracket {
  font-weight: bold;
  padding: 0 2px;
}
</style>