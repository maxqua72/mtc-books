<template>
  <div class="chess-tree-render-inline">
    <template v-for="(node, index) in nodes" :key="node.id">
      <!-- Contenitore della mossa singola -->
      <span 
        class="chess-move-item"
        :class="{ 'is-active': isNodeActive(node.id) }"
        @click="selectMove(node.id)"
      >
        <span class="move-prefix">{{ getMovePrefix(node, index) }}</span>
        <span class="move-san">{{ node.san }}</span>
      </span>

      <!-- Render del commento se presente -->
      <div v-if="node.comment" class="move-comment-box" @click="activateThisTree">
        <span class="comment-bracket">{</span>
        <input 
          type="text" 
          :value="node.comment" 
          @input="updateComment(node.id, $event)"
          class="comment-input"
        />
        <span class="comment-bracket">}</span>
      </div>
      
      <!-- Input vuoto persistente -->
      <div v-else-if="isNodeActive(node.id)" class="move-comment-box is-empty" @click="activateThisTree">
        <input 
          type="text" 
          placeholder="Aggiungi commento..." 
          @change="updateComment(node.id, $event)"
          class="comment-input"
        />
      </div>

      <!-- Gestione Ricorsiva delle Varianti -->
      <template v-if="node.children && node.children.length > 1">
        <span class="variant-wrapper">
          <template v-for="(subTree, subIdx) in node.children.slice(1)" :key="subTree.id">
            <span class="bracket">(</span>
            <!-- Passiamo il treeId anche alle chiamate ricorsive -->
            <ChessMoveRenderer 
              :nodes="[subTree]" 
              :is-variant-root="true" 
              :tree-id="treeId" 
            />
            <span class="bracket">)</span>
          </template>
        </span>
      </template>

      <!-- Prosecuzione sulla linea principale -->
      <ChessMoveRenderer 
        v-if="node.children && node.children.length > 0" 
        :nodes="[node.children[0]]" 
        :is-variant-root="false"
        :tree-id="treeId"
      />
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

// Recupera l'albero specifico a cui appartiene questo renderer, senza affidarsi al "currentTree" globale
const myTree = computed(() => {
  return treeStore.trees.find(t => t.id === props.treeId)
})

// Un nodo è attivo solo se questo specifico albero è quello attivo in Pinia E l'ID corrisponde
const isNodeActive = (nodeId: string) => {
  return treeStore.activeTreeId === props.treeId && treeStore.activeNodeId === nodeId
}

// Forza l'attivazione dell'albero di appartenenza prima di selezionare la mossa
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

const updateComment = (nodeId: string, event: Event) => {
  // Assicurati che l'albero sia attivo quando si scrive un commento
  activateThisTree()
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