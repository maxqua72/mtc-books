<template>
  <node-view-wrapper class="chess-tree-block-container" contenteditable="false">
    <div class="block-header">
      <span class="game-title">📊 {{ currentTree?.title || 'Analisi Scacchi' }}</span>
      <button @click="deleteBlock" class="delete-btn">Elimina Partita</button>
    </div>
    
    <div class="block-content" @click="activateTree">
      <!-- Se l'albero è vuoto, mostra un placeholder -->
      <div v-if="!currentTree || currentTree.rootNodes.length === 0" class="empty-tree-placeholder">
        Muovi i pezzi sulla scacchiera per iniziare a registrare la partita in questo blocco...
      </div>
      
      <!-- Altrimenti avvia il ciclo ricorsivo di notazione -->
      <ChessMoveRenderer 
        v-else 
        :nodes="currentTree.rootNodes" 
        :tree-id="props.node.attrs.treeId"/>
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import { computed } from 'vue'
import { useChessTreeStore } from '../stores/chessTreeStore'
import ChessMoveRenderer from './ChessMoveRenderer.vue'

// Definiamo le opzioni del componente (incluso il nome) in modo nativo per Vue 3
defineOptions({
  name: 'ChessTreeBlockView'
})

const props = defineProps(nodeViewProps)
const treeStore = useChessTreeStore()

const currentTree = computed(() => {
  return treeStore.trees.find(t => t.id === props.node.attrs.treeId)
})

const activateTree = () => {
  if (props.node.attrs.treeId && treeStore.activeTreeId !== props.node.attrs.treeId) {
    // 1. Imposta questo albero come attivo globalmente
    treeStore.activeTreeId = props.node.attrs.treeId
    
    // 2. Ripristina l'ultimo nodo attivo registrato specificamente per questo albero
    const lastActiveNodeId = currentTree.value?.activeNodeId || null
    treeStore.setActiveNode(lastActiveNodeId)
  }
}

const deleteBlock = () => {
  if (props.node.attrs.treeId) {
    // 1. Rimuove l'albero dai dati di Pinia
    const index = treeStore.trees.findIndex(t => t.id === props.node.attrs.treeId)
    if (index !== -1) treeStore.trees.splice(index, 1)
    
    // 2. Rimuove il blocco intero dal documento di Tiptap
    props.deleteNode()
  }
}
</script>

<style scoped>
.chess-tree-block-container {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  margin: 1.5rem 0;
  background: #ffffff;
  overflow: hidden;
  display: block; /* Assicura un corretto rendering del wrapper in Tiptap */
}
.block-header {
  background: #f9fafb;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.game-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: #374151;
}
.delete-btn {
  background: #ef4444;
  color: #fff;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}
.block-content {
  padding: 12px;
  line-height: 1.8;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.empty-tree-placeholder {
  color: #9ca3af;
  font-style: italic;
  font-size: 0.95rem;
}
</style>