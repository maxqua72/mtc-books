<template>
  <div class="w-[400px] bg-white border border-neutral-200 rounded-lg p-4 shadow-sm space-y-4">
    <div class="flex items-center justify-between border-b border-neutral-100 pb-2">
      <span class="text-xs font-bold text-neutral-400 uppercase tracking-wider">Console Scacchiera</span>
      <button 
        @click="emit('reset')"
        class="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition underline underline-offset-4"
      >
        Resetta Posizione
      </button>
    </div>

    <!-- Toggle per Registrazione Live delle Mosse -->
    <div class="flex items-center justify-between bg-neutral-50 p-2 rounded border border-neutral-100">
      <span class="text-xs font-medium text-neutral-700">Scrivi mosse nel testo</span>
      <label class="relative inline-flex items-center cursor-pointer select-none">
        <input 
          type="checkbox" 
          :checked="treeStore.isRecordingMoves"
          @change="treeStore.isRecordingMoves = !treeStore.isRecordingMoves"
          class="sr-only peer"
        />
        <div class="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neutral-900"></div>
      </label>
    </div>

    <!-- Dati in tempo reale -->
    <div class="grid grid-cols-3 gap-2 items-center">
      <span class="text-xs font-medium text-neutral-500">Ultima mossa:</span>
      <span class="col-span-2 justify-self-start font-mono bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-xs text-neutral-800 font-bold">
        {{ lastMove }}
      </span>
    </div>

    <div class="space-y-1">
      <span class="text-xs font-medium text-neutral-500 block">Notazione FEN corrente:</span>
      <code class="block font-mono text-[11px] bg-neutral-900 text-neutral-300 p-2 rounded break-all select-all leading-relaxed">
        {{ currentFen }}
      </code>
    </div>

    <!-- Pulsanti Azione Libreria/Testo -->
    <div class="flex gap-2">
      <button 
        @click="emit('insertDiagram')"
        class="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium rounded text-xs tracking-wide transition uppercase font-bold shadow-sm border border-neutral-200"
      >
        Inserisci Diagramma
      </button>
      
      <button 
        v-if="treeStore.activeNodeId"
        @click="emit('deleteBranch')"
        class="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded text-xs transition uppercase font-bold border border-red-200"
        title="Elimina variante corrente"
      >
        Elimina Variante
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChessTreeStore } from '../../stores/chessTreeStore'

defineProps<{
  currentFen: string
  lastMove: string
}>()

const emit = defineEmits<{
  (e: 'reset'): void
  (e: 'insertDiagram'): void
  (e: 'deleteBranch'): void
}>()

const treeStore = useChessTreeStore()
</script>