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



    <!-- Sistema di Navigazione Tab -->
    <div class="space-y-3">
      <div class="flex border-b border-neutral-200 text-xs font-semibold">
        <button 
          @click="activeTab = 'fen'"
          :class="activeTab === 'fen' ? 'border-b-2 border-black text-black' : 'text-neutral-400 hover:text-neutral-600'"
          class="pb-1.5 px-2 transition"
        >
          FEN
        </button>
        <button 
          @click="activeTab = 'pgn'"
          :class="activeTab === 'pgn' ? 'border-b-2 border-black text-black' : 'text-neutral-400 hover:text-neutral-600'"
          class="pb-1.5 px-2 transition"
        >
          Importa PGN
        </button>
      </div>

      <!-- CONTENUTO TAB FEN (Ripristinato e Intatto) -->
      <div v-if="activeTab === 'fen'" class="space-y-1">
        <div class="flex justify-between items-center">
          <span class="text-[11px] font-medium text-neutral-400">Notazione FEN corrente:</span>
          <button 
            @click="copyFenToClipboard" 
            class="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 transition flex items-center gap-1"
          >
            {{ copied ? 'Copiato!' : 'Copia FEN' }}
          </button>
        </div>
        <input 
          type="text"
          :value="currentFen"
          @change="handleFenChange"
          class="w-full font-mono text-[11px] bg-neutral-900 text-neutral-300 p-2 rounded break-all focus:outline-none focus:ring-1 focus:ring-neutral-500 select-all leading-relaxed border border-neutral-800"
        />
      </div>

      <!-- CONTENUTO TAB PGN (Nuova area di testo) -->
      <div v-if="activeTab === 'pgn'" class="space-y-2">
        <span class="text-[11px] font-medium text-neutral-400 block">Incolla qui il testo PGN del file o della partita:</span>
        <textarea 
          v-model="pgnInput"
          rows="3"
          placeholder="1. e4 e5 2. Nf3 Nc6..."
          class="w-full font-mono text-[11px] bg-neutral-50 border border-neutral-200 p-2 rounded focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none leading-relaxed text-neutral-800"
        ></textarea>
        <button 
          @click="handlePgnSubmit"
          :disabled="!pgnInput.trim()"
          class="w-full py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white disabled:bg-neutral-200 disabled:text-neutral-400 font-medium rounded text-xs transition uppercase font-bold"
        >
          Elabora e Costruisci Albero
        </button>
      </div>
    </div>

    <!-- Pulsanti Azione Libreria/Testo -->
    <div class="flex gap-2 pt-2">
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
import { ref } from 'vue'
import { useChessTreeStore } from '../../stores/chessTreeStore'

const props = defineProps<{
  currentFen: string
  lastMove: string
}>()

const emit = defineEmits<{
  (e: 'reset'): void
  (e: 'insertDiagram'): void
  (e: 'deleteBranch'): void
  (e: 'updateFen', newFen: string): void
  (e: 'importPgn', pgnData: string): void
}>()

const treeStore = useChessTreeStore()
const activeTab = ref<'fen' | 'pgn'>('fen')
const pgnInput = ref('')
const copied = ref(false)



const copyFenToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.currentFen)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (err) {
    console.error('Impossibile copiare il FEN:', err)
  }
}

const handleFenChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target && target.value.trim() !== '') {
    emit('updateFen', target.value.trim())
  }
}

const handlePgnSubmit = () => {
  if (pgnInput.value.trim()) {
    emit('importPgn', pgnInput.value.trim())
    pgnInput.value = '' // Svuota la textarea ad importazione avviata
  }
}
</script>