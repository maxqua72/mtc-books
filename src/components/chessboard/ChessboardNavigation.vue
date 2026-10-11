<template>
  <div class="w-[402px] space-y-2">
    <div class="flex gap-2">
      <button v-for="b in navButtons" :key="b.icon"
        @click="b.action" :disabled="b.disabled" :title="b.title" :aria-label="b.title"
        class="flex-1 h-11 flex items-center justify-center rounded-md bg-neutral-900 text-white text-base transition
               hover:bg-neutral-700 active:scale-95
               focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2
               disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed disabled:active:scale-100">
        <i :class="['fa-solid', b.icon]"></i>
      </button>
    </div>

    <!-- Compare solo se la scacchiera mostra una posizione fuori dall'albero -->
    <div v-if="isDetached"
      class="flex items-center justify-between text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
      <span>Posizione libera: non è nell'albero.</span>
      <button @click="treeStore.setActiveNode(treeStore.activeNodeId)" class="font-semibold underline">
        Torna al nodo
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChessTreeStore } from '../../stores/chessTreeStore'

const treeStore = useChessTreeStore()

const siblings = computed(() => treeStore.currentSiblings)
const siblingIndex = computed(() => siblings.value.findIndex(n => n.id === treeStore.activeNodeId))

// Senza albero attivo tutte queste condizioni portano i pulsanti allo stato "disattivato"
const atStart = computed(() => treeStore.activeNodeId === null)
const atEnd = computed(() => treeStore.currentChildren.length === 0)
const hasPrevVariant = computed(() => siblingIndex.value > 0)
const hasNextVariant = computed(() =>
  siblingIndex.value !== -1 && siblingIndex.value < siblings.value.length - 1
)

const navButtons = computed(() => [
  { icon: 'fa-backward-step', title: 'Inizio (Home)', action: () => treeStore.goToStart(), disabled: atStart.value },
  { icon: 'fa-chevron-up', title: 'Variante precedente (↑)', action: () => treeStore.goToSibling(-1), disabled: !hasPrevVariant.value },
  { icon: 'fa-chevron-left', title: 'Mossa precedente (←)', action: () => treeStore.goBack(), disabled: atStart.value },
  { icon: 'fa-chevron-right', title: 'Mossa successiva (→)', action: () => treeStore.goForward(), disabled: atEnd.value },
  { icon: 'fa-chevron-down', title: 'Variante successiva (↓)', action: () => treeStore.goToSibling(1), disabled: !hasNextVariant.value },
  { icon: 'fa-forward-step', title: 'Fine della linea (Fine)', action: () => treeStore.goToEnd(), disabled: atEnd.value },
])

// La scacchiera mostra una posizione che non coincide con quella del nodo attivo
const isDetached = computed(() => {
  const tree = treeStore.currentTree
  if (!tree) return false
  const expected = treeStore.currentNode ? treeStore.currentNode.fen : tree.startingFen
  return treeStore.activeFen !== expected
})
</script>