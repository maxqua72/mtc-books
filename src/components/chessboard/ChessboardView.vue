<template>
  <!-- Il wrapper esterno gestisce le dimensioni rigide, il bordo e il clip per tagliare i sub-pixel -->
  <div class="chessboard-container shadow-xl border-2 border-black rounded-sm overflow-hidden w-[400px] h-[400px]">
    <div 
      ref="boardElement" 
      class="w-full h-full cburnett bg-white"
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
}>()

const emit = defineEmits<{
  (e: 'move', orig: Key, dest: Key): void
}>()

const boardElement = ref<HTMLElement | null>(null)
let cgApi: Api | null = null

const updateBoard = () => {
  if (!cgApi) return
  
  if (cgApi.getFen() === props.fen) return 

  cgApi.set({
    fen: props.fen,
    turnColor: props.turnColor,
    movable: {
      color: props.turnColor,
      dests: props.dests
    }
  })
}

watch(() => props.fen, updateBoard)
watch(() => props.dests, updateBoard)

onMounted(() => {
  if (boardElement.value) {
    cgApi = Chessground(boardElement.value, {
      fen: props.fen,
      movable: { 
        color: props.turnColor, 
        free: false,
        dests: props.dests
      },
      events: { 
        move: (orig, dest) => emit('move', orig, dest) 
      }
    })
  }
})

onBeforeUnmount(() => {
  if (cgApi) cgApi.destroy()
})
</script>

<style scoped>
/*
  Correzione chirurgica per il gap sub-pixel:
  Applichiamo box-sizing coerente solo al wrapper e forziamo cg-wrap 
  a riempire perfettamente il box senza sovrascrivere la griglia cg-board.
*/
.chessboard-container :deep(.cg-wrap) {
  width: 400px !important;
  height: 400px !important;
}
</style>