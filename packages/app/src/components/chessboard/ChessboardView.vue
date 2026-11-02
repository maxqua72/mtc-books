<template>
  <div class="chessboard-outer flex items-center justify-center rounded-sm"
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
import type { DrawShape } from 'chessground/draw'
import { cleanShapes, type BoardShape } from '../../utils/shapes'

const props = defineProps<{
  fen: string
  turnColor: 'white' | 'black'
  orientation?: 'white' | 'black'
  dests: Map<Key, Key[]>
  linked?: boolean   // modalità albero: bordo azzurro
  shapes?: BoardShape[]   // frecce e marcatori della posizione mostrata
  autoShapes?: { orig: string; dest?: string; brush?: string }[]   // frecce temporanee, non disegnabili dall'utente
}>()

const emit = defineEmits<{
  (e: 'move', orig: Key, dest: Key): void
  (e: 'shapes', shapes: BoardShape[]): void   // l'utente ha disegnato o tolto una freccia/un cerchio
}>()

const boardElement = ref<HTMLElement | null>(null)
let cgApi: Api | null = null
let resizeObserver: ResizeObserver | null = null
let rafId = 0

const boardConfig = () => ({
  turnColor: props.turnColor,
  movable: { color: props.turnColor, dests: props.dests }
})

const toDrawShapes = (shapes?: BoardShape[]): DrawShape[] =>
  (shapes ?? []).map(s => ({ orig: s.orig as Key, ...(s.dest ? { dest: s.dest as Key } : {}), brush: s.brush }))

const updateBoard = () => {
  if (!cgApi) return
  const samePieces = cgApi.getFen() === props.fen.split(' ')[0]
  // turno e mosse legali vanno aggiornati SEMPRE; i pezzi solo se sono cambiati.
  // Chessground azzera le forme quando riceve un FEN: si passano nella stessa chiamata.
  cgApi.set(samePieces
    ? boardConfig()
    : { fen: props.fen, ...boardConfig(), drawable: { shapes: toDrawShapes(props.shapes) } })
}

// Stessa posizione, solo ridisegnata: le frecce attualmente sulla scacchiera restano
const resync = () => {
  if (!cgApi) return
  cgApi.set({ fen: props.fen, ...boardConfig(), drawable: { shapes: [...cgApi.state.drawable.shapes] } })
}

const syncShapes = () => cgApi?.setShapes(toDrawShapes(props.shapes))

const syncAuto = () => cgApi?.setAutoShapes(
  (props.autoShapes ?? []).map(s => ({ orig: s.orig as Key, ...(s.dest ? { dest: s.dest as Key } : {}), brush: s.brush ?? 'paleBlue' }))
)

/** Forme attualmente sulla scacchiera, normalizzate (servono anche quando la posizione non ha un nodo) */
const getShapes = (): BoardShape[] => (cgApi ? cleanShapes(cgApi.state.drawable.shapes) : [])
const clearShapes = () => cgApi?.setShapes([])

// Cambio posizione: prima pezzi e turno, poi le forme del nodo (anche se i pezzi erano già a posto per un drag)
watch(() => props.fen, () => { updateBoard(); syncShapes(); syncAuto() })
watch(() => props.dests, updateBoard)
watch(() => props.shapes, syncShapes)
watch(() => props.autoShapes, syncAuto, { deep: true })

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
    orientation: props.orientation ?? 'white',
    movable: { 
      color: props.turnColor, 
      free: false,
      dests: props.dests,
    },
    events: { 
      move: (orig, dest) => emit('move', orig, dest) 
    },
    drawable: {
      shapes: toDrawShapes(props.shapes),
      // un clic normale (selezionare un pezzo) non deve cancellare le frecce salvate: c'è il pulsante "Cancella frecce"
      eraseOnClick: false,
      onChange: (shapes: DrawShape[]) => emit('shapes', cleanShapes(shapes))
    }
  })

  syncAuto()

  // Solo per i test dalla console del browser
  if (import.meta.env.DEV) (window as any).cgApi = cgApi

  watch(() => props.orientation, (o) => cgApi?.set({ orientation: o ?? 'white' }))

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



defineExpose({ redraw: remeasure, resync, getShapes, clearShapes })
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
/*
.chessboard-outer.linked :deep(cg-container) {
    outline-color: #3b82f6;
}*/

/* Tema della scacchiera: verde in modalità libera, marrone in modalità albero */
.chessboard-outer :deep(cg-board) {
  background-image: url('../../assets/themes/cb-theme-green.svg');
  background-size: cover;
}
.chessboard-outer.linked :deep(cg-board) {
  background-image: url('../../assets/themes/cb-theme-brown.svg');
}

</style>