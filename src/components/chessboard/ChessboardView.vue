<template>
  <div 
    ref="boardElement" 
    class="w-[400px] h-[400px] shadow-xl border-2 border-black cburnett bg-white"
  ></div>
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
  
  // SE IL FEN CORRENTE DI CHESSGROUND È GIÀ UGUALE A QUELLO RICHIESTO, NON FARE NULLA
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

// Monitora i cambiamenti calcolati dal motore scacchistico del padre
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