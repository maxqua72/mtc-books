<template>
  <BaseModal :is-open="isOpen" panel-class="p-6" overlay-class="bg-black/50 backdrop-blur-sm" @close="close">
      
      <!-- Intestazione -->
      <div class="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
        <h3 class="text-lg font-semibold text-neutral-900 font-serif">Proprietà del Libro</h3>
        <button @click="close" class="text-neutral-400 hover:text-neutral-600 transition p-1 rounded-md hover:bg-neutral-100">
          ✕
        </button>
      </div>

      <p v-if="store.isLocked" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-3">
        Documento in sola lettura: abilita le modifiche dall'intestazione per cambiare queste impostazioni.
      </p>

      <!-- Corpo del Form -->
      <fieldset :disabled="store.isLocked" class="space-y-4 flex-1 overflow-y-auto pr-1 border-0 p-0 m-0 min-w-0">
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

        <!-- Spaziatura -->
        <div>
          <label class="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Spaziatura (mm)</label>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <span class="block text-[11px] text-neutral-500 mb-1">Tra paragrafi</span>
              <input type="number" min="0" max="30" step="0.5" v-model.number="store.metadata.paragraphSpacing"
                class="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500" />
            </div>
            <div>
              <span class="block text-[11px] text-neutral-500 mb-1">Intorno ai diagrammi</span>
              <input type="number" min="0" max="30" step="0.5" v-model.number="store.metadata.diagramSpacing"
                class="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500" />
            </div>
            <div>
              <span class="block text-[11px] text-neutral-500 mb-1">Intorno alle varianti</span>
              <input type="number" min="0" max="30" step="0.5" v-model.number="store.metadata.variationSpacing"
                class="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500" />
            </div>
          </div>
          <p class="text-xs text-neutral-400 mt-1">Valgono per tutto il libro, nell'editor e nel PDF.</p>
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
          <label class="flex items-center gap-3 select-none" :class="columnsAvailable ? 'cursor-pointer' : 'cursor-not-allowed'">
            <input type="checkbox" v-model="twoColumnsChecked" :disabled="!columnsAvailable" class="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 h-4 w-4" />
            <div>
              <span class="text-sm font-medium" :class="columnsAvailable ? 'text-neutral-800' : 'text-neutral-400'">Layout a due colonne</span>
              <p class="text-xs text-neutral-400">
                {{ columnsAvailable
                  ? 'Dispone il testo in due colonne affiancate (stile rivista di scacchi)'
                  : 'Non disponibile con B-Format: le colonne sarebbero troppo strette.' }}
              </p>
            </div>
          </label>
          <p v-if="!columnsAvailable && store.metadata.isTwoColumns" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            Il libro resta a colonna unica. Le due colonne tornano se scegli A4 o Crown Quarto.
          </p>
        </div>
      </fieldset>

      <!-- Pulsante di Chiusura -->
      <div class="border-t border-neutral-100 pt-3 mt-4 flex justify-end">
        <button @click="close" class="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition">
          Salva e Chiudi
        </button>
      </div>

  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { twoColumnsAvailable } from '../utils/twoColumns'
import BaseModal from './BaseModal.vue'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits(['close'])

const store = useChessBookStore()

const columnsAvailable = computed(() => twoColumnsAvailable(store.metadata.pageFormat))

// Con un formato escluso la casella appare spenta, ma la preferenza salvata resta per quando si cambia formato
const twoColumnsChecked = computed({
  get: () => columnsAvailable.value && store.metadata.isTwoColumns,
  set: (value: boolean) => { store.metadata.isTwoColumns = value },
})

const close = () => {
  emit('close')
}
</script>