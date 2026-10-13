<template>
  <node-view-wrapper class="chess-tree-block-container" :class="{ 'is-active-tree': isActive,  'is-pgn-target': !!pgnBadge }" @mousedown="onMouseDown"
    @click="activateTree">
    <div v-if="pgnBadge" class="pgn-target-badge" contenteditable="false">{{ pgnBadge }}</div>
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
      <ChessMoveRenderer v-else :nodes="currentTree.rootNodes" :tree-id="props.node.attrs.treeId" />
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import { computed } from 'vue'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { usePgnImportStore } from '../stores/pgnImportStore'
import ChessMoveRenderer from './ChessMoveRenderer.vue'

defineOptions({
  name: 'ChessTreeBlockView'
})

const props = defineProps(nodeViewProps)
const treeStore = useChessTreeStore()
const pgnStore = usePgnImportStore()

const pgnBadge = computed(() => {
  const badge = pgnStore.targetBadge
  return badge && badge.treeId === props.node.attrs.treeId ? badge.text : null
})

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

const isActive = computed(() => treeStore.activeTreeId === props.node.attrs.treeId)

const onMouseDown = (event: MouseEvent) => {
  const wrapper = event.currentTarget as HTMLElement
  const target = event.target as HTMLElement

  // Commenti editabili, input e bottoni mantengono il comportamento nativo.
  // Il controllo "wrapper.contains" serve perché .ProseMirror è a sua volta contenteditable
  const editable = target.closest(
    '[contenteditable]:not([contenteditable="false"]), input, textarea, button'
  )
  if (editable && editable !== wrapper && wrapper.contains(editable)) return

  event.preventDefault()          // il browser non sposta il cursore nel paragrafo vicino
  props.editor.commands.blur()    // niente focus nel testo: nessun paragrafo evidenziato
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
    /* Padding (6px) e bordo (1px) stanno dentro il riquadro: li sottraiamo
     perché lo spazio visibile coincida con quello del PDF, dove non ci sono */
  margin-top: max(0px, calc(var(--variation-spacing, 4mm) - 7px));
  margin-bottom: max(0px, calc(var(--variation-spacing, 4mm) - 7px));
  display: block;
  position: relative;

  /* L'effetto allargamento: aggiungiamo spazio interno ma lo compensiamo 
     portando il riquadro all'esterno con i margini negativi */
  padding: 6px;
  margin-left: -7px;
  /* Sposta il riquadro a sinistra (-6px padding - 1px bordo) */
  margin-right: -7px;
  /* Sposta il riquadro a destra */

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

.chess-tree-block-container.is-active-tree {
  background-color: rgba(239, 246, 255, 0.4);
}

/* Stessa linea blu dei paragrafi (-12px), compensando il margin-left: -7px del blocco */
.chess-tree-block-container.is-active-tree::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: #3b82f6;
  border-radius: 2px;
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

.chess-tree-block-container.is-pgn-target {
  outline: 2px dashed #3b82f6;
  outline-offset: 3px;
  background-color: rgba(59, 130, 246, 0.05);
}

.pgn-target-badge {
  display: inline-block;
  margin: 0 0 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font: 600 11px ui-sans-serif, system-ui, sans-serif;
  user-select: none;
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

  .chess-tree-block-container::before {
    display: none !important;
  }


  .block-header {
    display: none !important;
  }
}
</style>