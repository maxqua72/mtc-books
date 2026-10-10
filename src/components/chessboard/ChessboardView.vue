<template>
  <div class="chessboard-outer flex items-center justify-center bg-neutral-900 shadow-xl rounded-sm">
    <!-- Div bersaglio di Chessground centrato al pixel -->
    <div 
      ref="boardElement" 
      class="board-target cburnett"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Key } from 'chessground/types'

const props = defineProps<{
  fen: string
  turnColor: 'white' | 'black'
  dests: Map<Key, Key[]>
}>()

const emit = defineEmits<{
  (e: 'move', orig: Key, dest: Key): void
}>()

const boardElement = ref<HTMLElement | null>(null)
let cgApi: Api | null = null
let resizeObserver: ResizeObserver | null = null

const boardConfig = () => ({
  turnColor: props.turnColor,
  movable: { color: props.turnColor, dests: props.dests }
})

const updateBoard = () => {
  if (!cgApi) return
  const samePieces = cgApi.getFen() === props.fen.split(' ')[0]
  // turno e mosse legali vanno aggiornati SEMPRE; i pezzi solo se sono cambiati
  cgApi.set(samePieces ? boardConfig() : { fen: props.fen, ...boardConfig() })
}

const resync = () => cgApi?.set({ fen: props.fen, ...boardConfig() })

watch(() => props.fen, updateBoard)
watch(() => props.dests, updateBoard)

onMounted(() => {
  if (!boardElement.value) return

  // 1. Inizializzazione standard di Chessground
  cgApi = Chessground(boardElement.value, {
    fen: props.fen,
    coordinates: true,
    movable: { 
      color: props.turnColor, 
      free: false,
      dests: props.dests
    },
    events: { 
      move: (orig, dest) => emit('move', orig, dest) 
    }
  })

  // Esposizione temporanea per la console
    ;(window as any).cgApi = cgApi

  // 2. FORZATURA REDRAW:
  // Ascoltiamo i cambiamenti dimensionali effettivi del DOM.
  // Appena il div diventerà stabile a 400px, invochiamo redrawAll()
  resizeObserver = new ResizeObserver(() => {
    console.log("[ChessboardView] ResizeObserver: Forzando redrawAll()")
    if (cgApi) {
      console.log("[ChessboardView] ResizeObserver: cgApi esistente, invocando redrawAll()")
      // Force-redraw della matrice e riposizionamento pezzi
      console.log(cgApi)
      cgApi.redrawAll()
    }
  })

  resizeObserver.observe(boardElement.value)

  // 3. Secondo livello di sicurezza: forziamo un redraw al termine del tick di Vue
  nextTick(() => {
    console.log("[ChessboardView] nextTick: Forzando redrawAll()")
    requestAnimationFrame(() => {
      console.log("[ChessboardView] requestAnimationFrame: Forzando redrawAll()")
      if (cgApi) cgApi.redrawAll()
    })
  })
/*
  setTimeout(() => {
    if (cgApi) cgApi.redrawAll()
  }, 100)*/
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (cgApi) cgApi.destroy()
})

// Alla fine del setup di ChessboardView.vue
const forceRedraw = () => {
  if (cgApi) {
    cgApi.redrawAll()
  }
}

defineExpose({ redraw: forceRedraw, resync })
</script>

<style scoped>
/* 1. Il riquadro esterno ha la dimensione desiderata */
.chessboard-outer {
  width: 402px;
  height: 402px;
  /*box-sizing: border-box;*/
}

/* 2. La scacchiera si adatta all'interno e si posiziona al centro */
.board-target {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 3. Centratura forzata del contenitore generato da Chessground */
:deep(.cg-wrap) {
  margin: auto !important;
  box-sizing: content-box;
  display: block;
}
:deep(cg-container) {
    outline: 2px solid black;
}

</style>