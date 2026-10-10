<template>
  <node-view-wrapper class="chess-tree-block-container" @click="activateTree">
    <!-- Header comandi stile Gmail: compare in posizione assoluta solo all'hover del blocco -->
    <div class="block-header">
      <span class="game-title">📊 {{ currentTree?.title || 'Analisi Scacchi' }}</span>
      <button @click.stop="deleteBlock" class="delete-btn" title="Elimina intero blocco partita">
        ✕
      </button>
    </div>
    
    <div class="block-content">
      <!-- Se l'albero è vuoto, mostra un placeholder -->
      <div v-if="!currentTree || currentTree.rootNodes.length === 0" class="empty-tree-placeholder">
        Muovi i pezzi sulla scacchiera per iniziare a registrare la partita in questo blocco...
      </div>
      
      <!-- Altrimenti avvia il ciclo ricorsivo di notazione -->
      <ChessMoveRenderer 
        v-else 
        :nodes="currentTree.rootNodes" 
        :tree-id="props.node.attrs.treeId"
      />
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import { computed } from 'vue'
import { useChessTreeStore } from '../stores/chessTreeStore'
import ChessMoveRenderer from './ChessMoveRenderer.vue'

defineOptions({
  name: 'ChessTreeBlockView'
})

const props = defineProps(nodeViewProps)
const treeStore = useChessTreeStore()

const currentTree = computed(() => {
  return treeStore.trees.find(t => t.id === props.node.attrs.treeId)
})

const activateTree = () => {
  const id = props.node.attrs.treeId
  if (!id) return
  treeStore.ensureTree(id)
  if (treeStore.activeTreeId !== id) {
    treeStore.activeTreeId = id
    treeStore.setActiveNode(currentTree.value?.activeNodeId || null)
  }
}

const deleteBlock = () => {
  if (props.node.attrs.treeId) {
    if (confirm("Vuoi rimuovere interamente questa partita e tutta la sua notazione dal documento?")) {
      const index = treeStore.trees.findIndex(t => t.id === props.node.attrs.treeId)
      if (index !== -1) treeStore.trees.splice(index, 1)
      props.deleteNode()
    }
  }
}
</script>

<style scoped>
.chess-tree-block-container {
  margin: 1.5rem 0;
  display: block;
  position: relative;
  
  /* L'effetto allargamento: aggiungiamo spazio interno ma lo compensiamo 
     portando il riquadro all'esterno con i margini negativi */
  padding: 6px;
  margin-left: -7px;  /* Sposta il riquadro a sinistra (-6px padding - 1px bordo) */
  margin-right: -7px; /* Sposta il riquadro a destra */
  
  border: 1px solid transparent;
  border-radius: 6px;
  transition: background-color 0.2s, border-color 0.2s;
}

/* Quando il mouse passa sopra il blocco intero della partita */
.chess-tree-block-container:hover {
  background-color: rgba(248, 250, 252, 0.7);
  border-color: #cbd5e1;
}

/* Header comandi nascosto di base */
.block-header {
  display: none;
  position: absolute;
  top: -14px;
  right: 10px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 2px 8px;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
  z-index: 20;
}

/* Mostra l'header comandi solo all'hover */
.chess-tree-block-container:hover .block-header {
  display: flex;
}

.game-title {
  font-size: 0.75rem;
  font-family: ui-sans-serif, system-ui, sans-serif;
  color: #64748b;
  font-weight: 500;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #ef4444;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: ui-sans-serif, system-ui, sans-serif;
  transition: background-color 0.15s;
}

.delete-btn:hover {
  background-color: #fee2e2;
}

.block-content {
  padding: 0;
  line-height: 1.6;
  font-family: Lora, Georgia, Cambria, serif;
}

.empty-tree-placeholder {
  color: #9ca3af;
  font-style: italic;
  font-size: 0.95rem;
  padding: 8px;
  border: 1px dashed #cbd5e1;
  border-radius: 4px;
}

/* REGOLA PER LA STAMPA / ESPORTAZIONE PDF:
   Annulla completamente i margini negativi, i padding e nasconde l'interfaccia dell'hover */
@media print {
  .chess-tree-block-container {
    padding: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    border: none !important;
    background-color: transparent !important;
  }
  .block-header {
    display: none !important;
  }
}
</style>