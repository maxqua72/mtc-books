<template>
  <div class="w-[400px] bg-white border border-neutral-200 rounded-lg p-4 shadow-sm space-y-4">

    <TreeStatusBar />

    <div class="flex items-center justify-between border-b border-neutral-100 pb-2">
      <span class="text-xs font-bold text-neutral-400 uppercase tracking-wider">Console Scacchiera</span>
      <div class="flex items-center gap-3">
        <button @click="emit('clearShapes')"
          class="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition underline underline-offset-4"
          title="Frecce e cerchi: tasto destro sulla scacchiera (nero nel libro); con Maiusc o Ctrl (grigio nel libro)">
          Cancella frecce
        </button>
        <button v-if="showReset" @click="emit('reset')"
          class="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition underline underline-offset-4">
          Resetta Posizione
        </button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 items-center">
      <span class="text-xs font-medium text-neutral-500">Ultima mossa:</span>
      <span
        class="col-span-2 justify-self-start font-mono bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-xs text-neutral-800 font-bold">
        {{ lastMove }}
      </span>
    </div>

    <NagPalette v-if="showNags" :active-nags="activeNags" @toggle="toggleNag" />

    <div class="space-y-3">
      <div class="flex border-b border-neutral-200 text-xs font-semibold">
        <button @click="activeTab = 'fen'"
          :class="activeTab === 'fen' ? 'border-b-2 border-black text-black' : 'text-neutral-400 hover:text-neutral-600'"
          class="pb-1.5 px-2 transition">FEN</button>
        <button @click="activeTab = 'pgn'"
          :class="activeTab === 'pgn' ? 'border-b-2 border-black text-black' : 'text-neutral-400 hover:text-neutral-600'"
          class="pb-1.5 px-2 transition">Importa PGN</button>
        <button v-if="engineAvailable" @click="activeTab = 'engine'"
          :class="activeTab === 'engine' ? 'border-b-2 border-black text-black' : 'text-neutral-400 hover:text-neutral-600'"
          class="pb-1.5 px-2 transition">Motore</button>
      </div>

      <FenPanel v-if="activeTab === 'fen'" :current-fen="currentFen" @update-fen="emit('updateFen', $event)" />
      <PgnImportPanel v-else-if="activeTab === 'pgn'" />
      <component :is="EnginePanel" v-if="EnginePanel" v-show="activeTab === 'engine'" />
    </div>

    <div class="flex flex-wrap gap-2 pt-2">
      <button @click="emit('insertDiagram')" :disabled="!inChapter || locked"
        class="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-xs tracking-wide transition uppercase font-bold shadow-sm border border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed">
        Inserisci Diagramma
      </button>

      <button v-if="tree && treeStore.activeNodeId && !locked" @click="emit('deleteBranch')"
        class="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs transition uppercase font-bold border border-red-200"
        title="Elimina la mossa selezionata e tutto ciò che la segue">
        Elimina Variante
      </button>

      <!-- Riordino delle varianti: agisce sulla linea che contiene la mossa selezionata -->
      <div v-if="showReorder" class="w-full flex gap-2">
        <button @click="emit('promoteVariation')" :disabled="!canPromote" :title="promoteTitle" class="reorder-btn"><i
            class="fa-solid fa-arrow-up"></i> Promuovi</button>
        <button @click="emit('makeMainLine')" :disabled="!canPromote" :title="mainTitle" class="reorder-btn"><i
            class="fa-solid fa-angles-up"></i> Rendi principale</button>
        <button @click="emit('demoteVariation')" :disabled="!canDemote" :title="demoteTitle" class="reorder-btn"><i
            class="fa-solid fa-arrow-down"></i> Abbassa</button>
      </div>

      <button v-if="!tree || fenLocked" @click="emit('newTree')" :disabled="!inChapter || locked"
        class="w-full py-2 bg-white hover:bg-neutral-50 text-neutral-700 rounded text-xs transition font-semibold border border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed">
        + Nuovo albero da questa posizione
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, computed } from 'vue'
import { useChessTreeStore } from '../../stores/chessTreeStore'
import { useChessBookStore } from '../../stores/chessBookStore'
import TreeStatusBar from './TreeStatusBar.vue'
import NagPalette from './NagPalette.vue'
import FenPanel from './FenPanel.vue'
import PgnImportPanel from './PgnImportPanel.vue'
import { capabilities } from '../../platform'

defineProps<{
  currentFen: string
  lastMove: string
}>()

const emit = defineEmits<{
  (e: 'reset'): void
  (e: 'insertDiagram'): void
  (e: 'deleteBranch'): void
  (e: 'updateFen', newFen: string): void
  (e: 'newTree'): void
  (e: 'clearShapes'): void
  (e: 'promoteVariation'): void
  (e: 'makeMainLine'): void
  (e: 'demoteVariation'): void
}>()

const treeStore = useChessTreeStore()
const bookStore = useChessBookStore()
// Il pannello del motore esiste solo nel desktop e si scarica solo lì
const engineAvailable = capabilities.engine
const EnginePanel = engineAvailable ? defineAsyncComponent(() => import('./EnginePanel.vue')) : null
const activeTab = ref<'fen' | 'pgn' | 'engine'>('fen')

const tree = computed(() => treeStore.currentTree)
const fenLocked = computed(() => treeStore.isFenLocked)
const showReset = computed(() => !tree.value || treeStore.isCurrentTreeEmpty)
// Diagrammi e alberi si inseriscono solo in un capitolo (copertina e indice non hanno testo)
const inChapter = computed(() => bookStore.activeSectionInfo?.type === 'chapter')
// Sola lettura: l'albero del documento non si modifica; la posizione libera e la navigazione restano attive
const locked = computed(() => bookStore.isLocked)

// Riordino varianti: la riga compare solo se la mossa attiva ha qualcosa da spostare;
// se l'albero è diviso in blocchi i pulsanti restano visibili ma disabilitati, con il motivo nel tooltip
const moves = computed(() => treeStore.variationMoves)
const showReorder = computed(() => !!tree.value && !!treeStore.activeNodeId && !locked.value
  && (!!moves.value.promote || !!moves.value.demote))
const canPromote = computed(() => !!moves.value.promote && !moves.value.blocked)
const canDemote = computed(() => !!moves.value.demote && !moves.value.blocked)
const moveLabel = (n: { moveNumber: number; color: 'w' | 'b'; san: string }) =>
  `${n.moveNumber}${n.color === 'w' ? '.' : '...'} ${n.san}`
const reorderTitle = (target: typeof moves.value.promote, text: (label: string) => string, none: string) =>
  moves.value.blocked ?? (target ? text(moveLabel(target)) : none)
const promoteTitle = computed(() => reorderTitle(moves.value.promote,
  l => `Promuovi ${l}: sale di un posto tra le alternative (la prima diventa linea principale)`,
  'La mossa è già nella linea principale'))
const mainTitle = computed(() => reorderTitle(moves.value.promote,
  l => `Rendi principale la linea di ${l}, a ogni livello di annidamento`,
  'La mossa è già nella linea principale'))
const demoteTitle = computed(() => reorderTitle(moves.value.demote,
  l => `Abbassa ${l}: scende di un posto (la principale diventa variante)`,
  'Nessuna alternativa dopo questa linea'))

// I simboli si assegnano alla mossa attiva di un albero del documento
const showNags = computed(() => !!tree.value && !!treeStore.currentNode && !locked.value)
const activeNags = computed(() => treeStore.currentNode?.nags ?? [])
const toggleNag = (code: number) => {
  const id = treeStore.activeNodeId
  if (id) treeStore.toggleNag(id, code)
}
</script>

<style scoped>
.reorder-btn {
  flex: 1;
  padding: 0.4rem 0.25rem;
  border-radius: 0.25rem;
  border: 1px solid var(--color-neutral-300, #d4d4d4);
  background: var(--color-neutral-50, #fafafa);
  color: var(--color-neutral-700, #404040);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.15s;
}

.reorder-btn:hover:not(:disabled) {
  background: var(--color-neutral-100, #f5f5f5);
}

.reorder-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>