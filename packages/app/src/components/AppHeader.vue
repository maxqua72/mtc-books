<template>
  <header class="th-header h-14 bg-white border-b border-neutral-200 px-6 flex items-center justify-between shadow-sm shrink-0">
    <!-- Brand / Logo -->
    <div class="flex items-center gap-3">
      <img :src="logo" alt="MTC Book" class="w-auto h-10 object-contain" />
      <span class="text-md font-black text-neutral-950 tracking-tight uppercase">MTC Book</span>
      <span class="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded font-mono border border-neutral-200">
        v{{ appVersion }}
      </span>

      <div class="h-4 w-[1px] bg-neutral-200 mx-1"></div>

      <SaveStatusIndicator :status="store.saveStatus" />
    </div>

    <!-- Azioni Globali Documento -->
    <div class="flex items-center gap-2">
      <button @click="handleNewBook"
        class="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer">
        Nuovo
      </button>

      <button @click="handleOpenFile"
        class="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer">
        Apri...
      </button>

      <button @click="isSettingsOpen = true"
        class="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer"
        title="Impostazioni: aspetto dell'applicazione">
        <i class="fa-solid fa-gear"></i>
      </button>

      <!-- Interruttore sola lettura / modifica -->
      <button v-if="store.isBookLoaded" @click="store.setLocked(!store.isLocked)" role="switch"
        :aria-checked="!store.isLocked"
        :title="store.isLocked ? 'Documento in sola lettura: clic per abilitare le modifiche' : 'Modifiche abilitate: clic per bloccare il documento'"
        class="flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-semibold transition cursor-pointer select-none"
        :class="store.isLocked
          ? 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
          : 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100'">
        <span class="relative inline-block w-7 h-4 rounded-full transition-colors"
          :class="store.isLocked ? 'bg-neutral-300' : 'bg-amber-500'">
          <span class="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform"
            :class="store.isLocked ? '' : 'translate-x-3'"></span>
        </span>
        {{ store.isLocked ? 'Sola lettura' : 'Modifica attiva' }}
      </button>

      <ExportSplitButton />

      <button @click="handleSaveFile"
        :title="store.fileDirty
          ? 'La copia su disco non è aggiornata rispetto al lavoro nel browser: clicca per salvare'
          : 'La copia su disco è aggiornata'"
        class="px-4 py-1.5 text-xs font-bold text-white rounded shadow transition cursor-pointer flex items-center gap-1.5"
        :class="store.fileDirty ? 'bg-red-600 hover:bg-red-700' : 'bg-neutral-900 hover:bg-neutral-800'">
        <span v-if="store.fileDirty" class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
        Salva Lavoro
      </button>
    </div>

    <SettingsModal :is-open="isSettingsOpen" @close="isSettingsOpen = false" />
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { useBookFileActions } from '../composables/useBookFileActions'
import logo from '../assets/mtcbooks-logo.png'
import SettingsModal from './SettingsModal.vue'
import SaveStatusIndicator from './SaveStatusIndicator.vue'
import ExportSplitButton from './ExportSplitButton.vue'

const appVersion = __APP_VERSION__
const store = useChessBookStore()
const isSettingsOpen = ref(false)
const { handleNewBook, handleOpenFile, handleSaveFile } = useBookFileActions()
</script>