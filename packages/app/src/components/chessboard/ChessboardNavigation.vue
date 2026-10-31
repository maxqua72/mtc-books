<template>
  <div class="w-[402px]">
    <div class="flex gap-2">
      <button v-for="b in leftButtons" :key="b.icon"
        @click="b.action" :disabled="b.disabled" :title="b.title" :aria-label="b.title"
        :class="navBtn">
        <i :class="['fa-solid', b.icon]"></i>
      </button>

      <!-- Inverti scacchiera: quadrato, al centro -->
      <button @click="treeStore.toggleBoardFlip()"
        :title="treeStore.boardFlipped ? 'Scacchiera invertita: clic per riportare il Bianco in basso' : 'Inverti la scacchiera'"
        aria-label="Inverti la scacchiera" :aria-pressed="treeStore.boardFlipped"
        class="shrink-0 w-8 h-8 flex items-center justify-center rounded-md border text-base transition active:scale-95
               focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
        :class="treeStore.boardFlipped
          ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
          : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100'">
        <i class="fa-solid fa-arrows-rotate"></i>
      </button>

      <button v-for="b in rightButtons" :key="b.icon"
        @click="b.action" :disabled="b.disabled" :title="b.title" :aria-label="b.title"
        :class="navBtn">
        <i :class="['fa-solid', b.icon]"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChessTreeStore } from '../../stores/chessTreeStore'

const treeStore = useChessTreeStore()

const navBtn = `flex-1 h-8 flex items-center justify-center rounded-md bg-neutral-900 text-white text-base transition
  hover:bg-neutral-700 active:scale-95
  focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2
  disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed disabled:active:scale-100`

const siblings = computed(() => treeStore.currentSiblings)
const siblingIndex = computed(() => siblings.value.findIndex(n => n.id === treeStore.activeNodeId))

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

const leftButtons = computed(() => navButtons.value.slice(0, 3))
const rightButtons = computed(() => navButtons.value.slice(3))
</script>