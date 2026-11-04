<template>
  <!-- Stesso schema di «Esporta»: l'azione principale esegue la scelta, la freccia la cambia. Nel web c'è solo Salva -->
  <div class="relative inline-flex items-center" v-click-outside="close">
    <button @click="execute" :title="title"
      class="px-4 py-1.5 text-xs font-bold text-white shadow transition cursor-pointer flex items-center gap-1.5"
      :class="[colors, canSaveAs ? 'rounded-l border-r border-white/25' : 'rounded']">
      <span v-if="store.fileDirty" class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
      {{ current.label }}
    </button>

    <button v-if="canSaveAs" @click="isOpen = !isOpen" title="Scegli come salvare" aria-haspopup="true" :aria-expanded="isOpen"
      class="px-2 py-1.5 text-xs font-bold text-white rounded-r shadow transition cursor-pointer self-stretch flex items-center justify-center"
      :class="colors">
      <svg class="w-3 h-3 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" fill="none"
        stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="isOpen"
      class="absolute right-0 top-full mt-1 w-48 bg-white border border-neutral-200 rounded shadow-lg z-50 py-1 font-sans">
      <button v-for="m in MODES" :key="m.id" @click="select(m.id)"
        class="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center justify-between cursor-pointer">
        <div class="flex flex-col">
          <span class="font-semibold text-neutral-900">{{ m.label }}</span>
          <span class="text-[10px] text-neutral-400 font-normal">{{ m.hint }}</span>
        </div>
        <svg v-if="mode === m.id" class="w-3 h-3 text-neutral-900 shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
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
import { platform } from '../platform'
import { useBookFileActions } from '../composables/useBookFileActions'
import { useChessBookStore } from '../stores/chessBookStore'
import { vClickOutside } from '../directives/clickOutside'

type SaveMode = 'save' | 'save-as'

const MODES: { id: SaveMode; label: string; hint: string }[] = [
  { id: 'save', label: 'Salva Lavoro', hint: 'Sul file del libro' },
  { id: 'save-as', label: 'Salva con nome…', hint: 'Scegli nome e cartella' },
]

const store = useChessBookStore()
const { handleSaveFile, handleSaveAs } = useBookFileActions()
const canSaveAs = !!platform.files.saveBookAs

const isOpen = ref(false)
const mode = ref<SaveMode>('save')
const current = computed(() => MODES.find((m) => m.id === mode.value)!)
const colors = computed(() => (store.fileDirty
  ? 'bg-red-600 hover:bg-red-700'
  : 'bg-neutral-900 hover:bg-neutral-800'))

const title = computed(() => {
  if (mode.value === 'save-as') return 'Scegli nome e cartella del file'
  return store.fileDirty
    ? 'La copia su disco non è aggiornata rispetto al lavoro nel browser: clicca per salvare'
    : 'La copia su disco è aggiornata'
})

const close = () => { isOpen.value = false }
const select = (id: SaveMode) => { mode.value = id; close() }

const execute = async () => {
  if (mode.value === 'save') { await handleSaveFile(); return }
  await handleSaveAs()
  mode.value = 'save'   // Il pulsante torna a salvare sul file: non si riapre il dialogo a ogni salvataggio
}
</script>
