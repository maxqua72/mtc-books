<template>
  <!-- Stato: posizione libera oppure albero collegato -->
  <div class="rounded-md border px-3 py-2 flex items-start justify-between gap-2"
    :class="tree ? 'border-blue-300 bg-blue-50' : 'border-neutral-200 bg-neutral-50'">
    <div class="min-w-0">
      <div class="text-xs font-bold truncate" :class="tree ? 'text-blue-800' : 'text-neutral-600'">
        {{ tree ? `Albero: ${tree.title}` : 'Posizione libera' }}
      </div>
      <div class="text-[11px]" :class="tree ? 'text-blue-700' : 'text-neutral-500'">{{ subtitle }}</div>
      <label v-if="tree && hasHeader"
        class="mt-1.5 flex items-center gap-1.5 text-[11px] text-blue-800 cursor-pointer select-none"
        v-tooltip.desc="'Mostra sopra il blocco giocatori, risultato, evento e apertura presi dal PGN'">
        <input type="checkbox" :checked="!!tree.showHeader" :disabled="locked" @change="onToggleHeader" />
        Mostra intestazione nel documento
      </label>
    </div>
    <button v-if="tree" @click="treeStore.deactivateTree()"
      class="shrink-0 text-[11px] font-semibold text-blue-800 underline underline-offset-2 hover:text-blue-950"
      v-tooltip.desc="'Scollega dall\'albero: la posizione resta sulla scacchiera e le mosse non vengono più registrate'">
      Scollega
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChessTreeStore } from '../../stores/chessTreeStore'
import { useChessBookStore } from '../../stores/chessBookStore'
import { hasDisplayableHeader } from '../../utils/pgnHeader'
import { vTooltip } from '../../directives/tooltip'

const treeStore = useChessTreeStore()
const bookStore = useChessBookStore()
const tree = computed(() => treeStore.currentTree)
const locked = computed(() => bookStore.isLocked)

// L'interruttore compare solo se l'albero ha tag PGN da mostrare
const hasHeader = computed(() => !!tree.value && hasDisplayableHeader(tree.value.header))
const onToggleHeader = (event: Event) => {
  if (tree.value && !locked.value) treeStore.setShowHeader(tree.value.id, (event.target as HTMLInputElement).checked)
}

const subtitle = computed(() => {
  if (!tree.value) return 'Mosse temporanee, non salvate nel documento'
  const node = treeStore.currentNode
  return node
    ? `dopo ${node.moveNumber}${node.color === 'w' ? '.' : '...'} ${node.san}`
    : 'Posizione iniziale dell’albero'
})
</script>
