<template>
  <!-- Web: il PDF si fa solo con l'app desktop. Un pulsante unico, senza la scelta capitolo/libro che non porterebbe
       a niente, con l'etichetta che lo dice prima del clic; il clic spiega come fare e porta allo scaricamento -->
  <button v-if="!pdfAvailable" @click="showPdfDesktopNotice()" v-tooltip.desc="'Il PDF si crea con l’app desktop di MTC Books'"
    class="mr-2 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow transition cursor-pointer active:bg-blue-800 inline-flex items-center gap-2">
    Esporta PDF
    <span class="px-1.5 py-px rounded bg-white/20 text-[10px] font-semibold uppercase tracking-wide">Desktop</span>
  </button>

  <!-- Split button persistente: la voce del menu esporta subito e diventa l'azione del pulsante principale -->
  <div v-else class="relative inline-flex items-center" v-click-outside="close">
    <button @click="execute"
      class="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-l shadow transition cursor-pointer border-r border-blue-700 active:bg-blue-800">
      {{ current.label }}
    </button>

    <button @click="isOpen = !isOpen"
      class="px-2 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-r shadow transition mr-2 cursor-pointer self-stretch flex items-center justify-center active:bg-blue-800"
      aria-haspopup="true" :aria-expanded="isOpen">
      <svg class="w-3 h-3 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" fill="none"
        stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="isOpen"
      class="absolute right-2 top-full mt-1 w-48 bg-white border border-neutral-200 rounded shadow-lg z-50 py-1 font-sans">
      <button v-for="m in MODES" :key="m.id" @click="select(m.id)"
        class="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center justify-between cursor-pointer">
        <div class="flex flex-col">
          <span class="font-semibold text-blue-700">{{ m.label }}</span>
          <span class="text-[10px] text-neutral-400 font-normal">{{ m.hint }}</span>
        </div>
        <svg v-if="mode === m.id" class="w-3 h-3 text-blue-600 shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { vClickOutside } from '../directives/clickOutside'
import { vTooltip } from '../directives/tooltip'
import { capabilities } from '../platform'
import { showPdfDesktopNotice } from '../platform/pdfNotice'

const pdfAvailable = capabilities.localPdf || capabilities.cloudPdf

type ExportMode = 'chapter-server' | 'book-server'

const MODES: { id: ExportMode; label: string; hint: string }[] = [
  { id: 'chapter-server', label: 'Esporta Capitolo (PDF)', hint: 'Solo la sezione aperta' },
  { id: 'book-server', label: 'Esporta Libro (PDF)', hint: 'Tutte le sezioni, con l\'indice aggiornato' },
]

const store = useChessBookStore()
const isOpen = ref(false)
// La voce del menu esporta subito e resta come azione del pulsante principale per le volte successive
const mode = ref<ExportMode>('chapter-server')
const current = computed(() => MODES.find(m => m.id === mode.value)!)

const close = () => { isOpen.value = false }
const select = (id: ExportMode) => { mode.value = id; close(); execute() }

const execute = () => {
  if (mode.value === 'chapter-server') store.triggerServerChapterPdfExport()
  else store.triggerServerFullBookPdfExport()
}
</script>
