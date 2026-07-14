<template>
  <div class="chess-tree-render-inline">
    <template v-for="(node, index) in nodes" :key="node.id">
      <!-- Contenitore della mossa singola -->
      <span 
        class="chess-move-item"
        :class="{ 'is-active': treeStore.activeNodeId === node.id }"
        @click="treeStore.setActiveNode(node.id)"
      >
        <!-- Prefisso numerico calcolato dinamicamente -->
        <span class="move-prefix">{{ getMovePrefix(node, index) }}</span>
        <span class="move-san">{{ node.san }}</span>
      </span>

      <!-- Render del commento se presente (Stile PGN con parentesi graffe o blocco dedicato) -->
      <div v-if="node.comment" class="move-comment-box">
        <span class="comment-bracket">{</span>
        <input 
          type="text" 
          :value="node.comment" 
          @input="updateComment(node.id, $event)"
          class="comment-input"
        />
        <span class="comment-bracket">}</span>
      </div>
      
      <!-- Input vuoto persistente per permettere di aggiungere un commento al volo alla mossa attiva -->
      <div v-else-if="treeStore.activeNodeId === node.id" class="move-comment-box is-empty">
        <input 
          type="text" 
          placeholder="Aggiungi commento..." 
          @change="updateComment(node.id, $event)"
          class="comment-input"
        />
      </div>

      <!-- Gestione Ricorsiva delle Varianti (children di indice > 0) -->
      <template v-if="node.children && node.children.length > 1">
        <span class="variant-wrapper">
          <template v-for="(subTree, subIdx) in node.children.slice(1)" :key="subTree.id">
            <span class="bracket">(</span>
            <!-- Chiamata ricorsiva passandogli il sotto-ramo come radice -->
            <ChessMoveRenderer :nodes="[subTree]" :is-variant-root="true" />
            <span class="bracket">)</span>
          </template>
        </span>
      </template>

      <!-- Prosecuzione sulla linea principale (primo figlio del nodo attuale) -->
      <ChessMoveRenderer 
        v-if="node.children && node.children.length > 0" 
        :nodes="[node.children[0]]" 
        :is-variant-root="false"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useChessTreeStore } from '../stores/chessTreeStore'
import type { ChessMoveNode } from '../stores/chessTreeStore'

const props = defineProps<{
  nodes: ChessMoveNode[]
  isVariantRoot?: boolean
}>()

const treeStore = useChessTreeStore()

const updateComment = (nodeId: string, event: Event) => {
  const target = event.target as HTMLInputElement
  treeStore.updateNodeComment(nodeId, target.value)
}

const getMovePrefix = (node: ChessMoveNode, index: number): string => {
  if (node.color === 'w') {
    return `${node.moveNumber}. `
  }
  
  // Se la mossa è del Nero ('b')
  // Caso 1: È l'inizio assoluto di una variante racchiusa tra parentesi tonde
  if (props.isVariantRoot && index === 0) {
    return `${node.moveNumber}... `
  }

  // Caso 2: Bisogna controllare se la mossa precedente (del Bianco) conteneva un commento
  // Poiché la struttura ricorsiva passa un nodo alla volta alla linea principale, 
  // recuperiamo il parent node dallo store per ispezionarlo.
  const parentNode = treeStore.findNodeById(treeStore.currentTree?.rootNodes || [], node.parentId || '')
  if (parentNode && parentNode.comment !== null) {
    return `${node.moveNumber}... `
  }

  // Caso standard: il Nero segue linearmente il Bianco senza interruzioni testuali
  return ''
}
</script>

<style scoped>
.chess-tree-render-inline {
  display: inline;
}
.chess-move-item {
  padding: 2px 4px;
  margin-right: 4px;
  cursor: pointer;
  border-radius: 4px;
  background: #f3f4f6;
}
.chess-move-item.is-active {
  background: #3b82f6;
  color: #fff;
}
.move-comment-box {
  display: inline-flex;
  align-items: center;
  color: #059669;
  font-style: italic;
  margin: 0 6px;
}
.comment-input {
  border: none;
  background: transparent;
  color: inherit;
  font-style: inherit;
  font-size: 0.95rem;
  padding: 0 4px;
  outline: none;
  width: auto;
  min-width: 120px;
}
.comment-bracket {
  font-weight: bold;
}
.variant-wrapper {
  color: #6b7280;
}
.bracket {
  font-weight: bold;
  padding: 0 2px;
}
</style>