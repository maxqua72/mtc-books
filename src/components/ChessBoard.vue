<template>
  <div class="w-full flex flex-col items-center gap-6">
    <!-- Contenitore della scacchiera con dimensioni fisse e ombra -->
    <div 
      ref="boardElement" 
      class="w-[400px] h-[400px] shadow-xl border-2 border-black cburnett bg-white"
    ></div>
    
    <!-- Console dei Metadati e Controlli Scacchistici spostata qui -->
    <div class="w-[400px] bg-white border border-neutral-200 rounded-lg p-4 shadow-sm space-y-4">
      <div class="flex items-center justify-between border-b border-neutral-100 pb-2">
        <span class="text-xs font-bold text-neutral-400 uppercase tracking-wider">Console Scacchiera</span>
        <button 
          @click="resetBoard"
          class="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition underline underline-offset-4"
        >
          Resetta Posizione
        </button>
      </div>

      <!-- Dati in tempo reale -->
      <div class="grid grid-cols-3 gap-2 items-center">
        <span class="text-xs font-medium text-neutral-500">Ultima mossa:</span>
        <span class="col-span-2 justify-self-start font-mono bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-xs text-neutral-800 font-bold">
          {{ lastMoveNotation }}
        </span>
      </div>

      <div class="space-y-1">
        <span class="text-xs font-medium text-neutral-500 block">Notazione FEN corrente:</span>
        <code class="block font-mono text-[11px] bg-neutral-900 text-neutral-300 p-2 rounded break-all select-all leading-relaxed">
          {{ store.activeFen }}
        </code>
      </div>

      <!-- Pulsante per iniettare il diagramma nell'editor -->
      <button 
        @click="triggerInsert"
        class="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded text-xs tracking-wide transition uppercase font-bold shadow-sm"
      >
        Inserisci Diagramma nel Testo
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Chess } from 'chess.js'
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Key } from 'chessground/types'
import { useChessBookStore } from '../stores/chessBookStore'

const boardElement = ref<HTMLElement | null>(null)
const chess = new Chess()
let cgApi: Api | null = null

// Istanziamo lo store globale
const store = useChessBookStore()

const lastMoveNotation = ref<string>('Nessuna')

const syncGameState = () => {
  const currentFen = chess.fen()
  
  // Invia il FEN in tempo reale allo store di Pinia
  store.updateActiveFen(currentFen)
  
  lastMoveNotation.value = chess.history().length > 0 ? chess.history()[chess.history().length - 1] : 'Nessuna'

  if (!cgApi) return

  const dests = new Map<Key, Key[]>()
  chess.moves({ verbose: true }).forEach(m => {
    if (!dests.has(m.from as Key)) dests.set(m.from as Key, [])
    dests.get(m.from as Key)!.push(m.to as Key)
  })

  cgApi.set({
    fen: currentFen,
    turnColor: chess.turn() === 'w' ? 'white' : 'black',
    movable: {
      color: chess.turn() === 'w' ? 'white' : 'black',
      dests: dests
    }
  })
}

const onMove = (orig: Key, dest: Key) => {
  try {
    chess.move({ from: orig, to: dest, promotion: 'q' })
    syncGameState()
  } catch (error) {
    if (cgApi) cgApi.set({ fen: chess.fen() })
  }
}

const resetBoard = () => {
  chess.reset()
  syncGameState()
}

// Invia il segnale di inserimento direttamente a Pinia
const triggerInsert = () => {
  store.triggerInsertDiagram()
}

onMounted(() => {
  if (boardElement.value) {
    cgApi = Chessground(boardElement.value, {
      fen: chess.fen(),
      movable: { color: 'white', free: false },
      events: { move: onMove }
    })
    syncGameState()
  }
})

onBeforeUnmount(() => {
  if (cgApi) cgApi.destroy()
})
</script>