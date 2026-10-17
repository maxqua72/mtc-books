<template>
  <div class="chessboard-outer flex items-center justify-center bg-neutral-900 shadow-xl rounded-sm"
    :class="{ linked }">
    <!-- Div bersaglio di Chessground centrato al pixel -->
    <div 
      ref="boardElement" 
      class="board-target cburnett"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Chessground } from 'chessground'
import type { Api } from 'chessground/api'
import type { Key } from 'chessground/types'

const props = defineProps<{
  fen: string
  turnColor: 'white' | 'black'
  dests: Map<Key, Key[]>
  linked?: boolean   // modalità albero: bordo azzurro
}>()

const emit = defineEmits<{
  (e: 'move', orig: Key, dest: Key): void
}>()

const boardElement = ref<HTMLElement | null>(null)
let cgApi: Api | null = null
let resizeObserver: ResizeObserver | null = null
let rafId = 0

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

// Chessground posiziona i pezzi con una misura della scacchiera messa in cache.
// Se la misura è obsoleta (layout non definitivo, zoom del browser, animazioni CSS)
// i pezzi risultano sfasati in modo progressivo verso destra e verso il basso:
// per questo rimisuriamo (redrawAll) ogni volta che le dimensioni reali possono cambiare.
const remeasure = () => {
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => cgApi?.redrawAll())
}

// Fine di una transizione/animazione su un antenato della scacchiera
const onTransitionEnd = (e: Event) => {
  const el = boardElement.value
  if (el && e.target instanceof Node && e.target.contains(el)) remeasure()
}

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

  // Solo per i test dalla console del browser
  if (import.meta.env.DEV) (window as any).cgApi = cgApi

  resizeObserver = new ResizeObserver(remeasure)
  resizeObserver.observe(boardElement.value)

  window.addEventListener('resize', remeasure)   // anche lo zoom del browser genera 'resize'
  document.addEventListener('transitionend', onTransitionEnd, true)
  document.addEventListener('animationend', onTransitionEnd, true)

  // Misura finale a layout assestato e a font caricati
  requestAnimationFrame(() => requestAnimationFrame(remeasure))
  document.fonts?.ready.then(remeasure)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  window.removeEventListener('resize', remeasure)
  document.removeEventListener('transitionend', onTransitionEnd, true)
  document.removeEventListener('animationend', onTransitionEnd, true)
  cgApi?.destroy()
})



defineExpose({ redraw: remeasure, resync })
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
.chessboard-outer.linked :deep(cg-container) {
    outline-color: #3b82f6;
}

</style>