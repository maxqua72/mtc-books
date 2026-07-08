<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-md p-6 overflow-hidden flex flex-col">
      
      <!-- Intestazione -->
      <div class="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
        <h3 class="text-lg font-semibold text-neutral-900 font-serif">Proprietà del Libro</h3>
        <button @click="close" class="text-neutral-400 hover:text-neutral-600 transition p-1 rounded-md hover:bg-neutral-100">
          ✕
        </button>
      </div>

      <!-- Corpo del Form -->
      <div class="space-y-4 flex-1 overflow-y-auto pr-1">
        <!-- Titolo -->
        <div>
          <label class="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Titolo del Libro</label>
          <input type="text" v-model="store.metadata.title" class="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500" />
        </div>

        <!-- Autore -->
        <div>
          <label class="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Autore</label>
          <input type="text" v-model="store.metadata.author" class="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500" />
        </div>

        <!-- Formato Pagina -->
        <div>
          <label class="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Formato di Stampa (Layout)</label>
          <select v-model="store.metadata.pageFormat" class="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 bg-white">
            <option value="a4">A4 Standard (210 x 297 mm)</option>
            <option value="crown-quarto">Crown Quarto (189 x 246 mm)</option>
            <option value="b-format">B-Format (129 x 198 mm)</option>
          </select>
        </div>

        <!-- Opzioni Booleane -->
        <div class="pt-2 space-y-3">
          <!-- Numerazione Titoli -->
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" v-model="store.metadata.showNumbering" class="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 h-4 w-4" />
            <div>
              <span class="text-sm font-medium text-neutral-800">Mostra numerazione automatica</span>
              <p class="text-xs text-neutral-400">Aggiunge i prefissi numerici ai capitoli (es: 1., 1.1) nell'editor e nell'indice</p>
            </div>
          </label>

          <!-- Doppia Colonna -->
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" v-model="store.metadata.isTwoColumns" class="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 h-4 w-4" />
            <div>
              <span class="text-sm font-medium text-neutral-800">Layout a due colonne</span>
              <p class="text-xs text-neutral-400">Dispone il testo in due colonne affiancate (stile rivista di scacchi)</p>
            </div>
          </label>
        </div>
      </div>

      <!-- Pulsante di Chiusura -->
      <div class="border-t border-neutral-100 pt-3 mt-4 flex justify-end">
        <button @click="close" class="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition">
          Salva e Chiudi
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useChessBookStore } from '../stores/chessBookStore'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits(['close'])

const store = useChessBookStore()

const close = () => {
  emit('close')
}
</script>