<template>
  <node-view-wrapper class="my-8 flex flex-col items-center justify-center content-box avoid-break">
    <div class="relative group border border-neutral-300 p-6 bg-white rounded-lg shadow-sm" contenteditable="false">
      
      <!-- Tasto di eliminazione -->
      <button 
        @click="deleteNode"
        class="absolute -top-3 -right-3 w-6 h-6 bg-neutral-950 hover:bg-neutral-200 hover:text-black text-white border border-neutral-300 rounded-full flex items-center justify-center text-xs font-bold shadow opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
      >
        ×
      </button>

      <!-- Contenitore Scacchiera con Coordinate Grandi e Centrate -->
      <div class="flex flex-col items-center justify-center bg-white select-none">
        
        
        <!-- Lettere Superiori (A-H) - Bilanciate al millimetro con la riga centrale -->
        <div class="flex items-center justify-center mb-2">
          <!-- Spaziatore sinistro identico alla colonna dei numeri (w-6 + mr-2) -->
          <div class="w-6 mr-2"></div>
          
          <!-- Griglia 8 colonne per le lettere con chiavi indicizzate corrette -->
          <div class="grid grid-cols-8 w-[320px] text-sm font-sans font-bold text-neutral-500 text-center">
            <div v-for="(letter, index) in ['A','B','C','D','E','F','G','H']" :key="'top-' + index">
              {{ letter }}
            </div>
          </div>
          
          <!-- Spaziatore destro identico alla colonna dei numeri (w-6 + ml-2) -->
          <div class="w-6 ml-2"></div>
        </div>

        <div class="flex items-center justify-center">
          <!-- Numeri Sinistri (8-1) - Centrati verticalmente simulando le altezze delle case -->
          <div class="flex flex-col h-[320px] w-[24px] justify-around text-sm font-sans font-bold text-neutral-500 text-right pr-2">
            <div v-for="num in ['8','7','6','5','4','3','2','1']" :key="num" class="h-full flex items-center justify-end">{{ num }}</div>
          </div>

          <!-- Il Cuore della Scacchiera 8x8 Pura in Chess Merida -->
          <div class="grid grid-cols-8 grid-rows-8 w-[320px] h-[320px] border-2 border-neutral-900 font-chess text-[40px] leading-none text-center bg-white overflow-hidden shadow-sm">
            <div 
              v-for="(square, index) in squares" 
              :key="index"
              class="w-full h-full flex items-center justify-center aspect-square m-0 p-0"
            >
              {{ getChessFontChar(square, isDarkSquare(index)) }}
            </div>
          </div>

          <!-- Numeri Destri (8-1) - Centrati verticalmente -->
          <div class="flex flex-col h-[320px] w-[24px] justify-around text-sm font-sans font-bold text-neutral-500 text-left pl-2">
            <div v-for="num in ['8','7','6','5','4','3','2','1']" :key="num" class="h-full flex items-center justify-start">{{ num }}</div>
          </div>
        </div>

        <!-- Lettere Inferiori (A-H) - Bilanciate al millimetro -->
        <div class="flex items-center justify-center mt-2">
          <!-- Spaziatore sinistro -->
          <div class="w-6 mr-2"></div>
          
          <!-- Griglia 8 colonne per le lettere con chiavi indicizzate corrette -->
          <div class="grid grid-cols-8 w-[320px] text-sm font-sans font-bold text-neutral-500 text-center">
            <div v-for="(letter, index) in ['A','B','C','D','E','F','G','H']" :key="'bottom-' + index">
              {{ letter }}
            </div>
          </div>
          
          <!-- Spaziatore destro -->
          <div class="w-6 ml-2"></div>
        </div>

      </div>
    </div>

    <!-- Didascalia del diagramma -->
    <node-view-content 
      class="text-xs text-center text-neutral-500 font-sans mt-2 italic max-w-[360px] border-b border-transparent hover:border-neutral-300 focus:border-neutral-900 outline-none px-2 py-0.5" 
      placeholder="Diagramma X: ..."
    />
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { nodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

// Casa a8 (indice 0) è BIANCA.
// Riga 0: B, S, B, S, B, S, B, S -> Gli indici dispari sono scuri.
const isDarkSquare = (index: number) => {
  const row = Math.floor(index / 8)
  const col = index % 8
  return (row + col) % 2 === 1
}

// Estrae i pezzi dal FEN
const squares = computed(() => {
  const fenRows = props.node.attrs.fen.split(' ')[0].split('/')
  const board: string[] = []

  for (const row of fenRows) {
    for (const char of row) {
      if (isNaN(Number(char))) {
        board.push(char)
      } else {
        const emptyCount = Number(char)
        for (let i = 0; i < emptyCount; i++) {
          board.push('')
        }
      }
    }
  }
  return board
})

const getChessFontChar = (piece: string, isDark: boolean) => {
  if (!piece) return isDark ? '+' : ' '

  const keymap: Record<string, { light: string; dark: string }> = {
    'P': { light: 'p', dark: 'P' }, 'p': { light: 'o', dark: 'O' },
    'N': { light: 'n', dark: 'N' }, 'n': { light: 'm', dark: 'M' },
    'B': { light: 'b', dark: 'B' }, 'b': { light: 'v', dark: 'V' },
    'R': { light: 'r', dark: 'R' }, 'r': { light: 't', dark: 'T' },
    'Q': { light: 'q', dark: 'Q' }, 'q': { light: 'w', dark: 'W' },
    'K': { light: 'k', dark: 'K' }, 'k': { light: 'l', dark: 'L' }
  }

  return isDark ? keymap[piece].dark : keymap[piece].light
}
</script>