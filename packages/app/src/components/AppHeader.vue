<template>
  <header
    class="th-header h-14 bg-white border-b border-neutral-200 px-6 flex items-center justify-between shadow-sm shrink-0">
    <!-- Brand / Logo -->
    <div class="flex items-center gap-3">
      <img :src="logo" alt="MTC Book" class="w-auto h-10 object-contain" />
      <span class="text-md font-black text-neutral-950 tracking-tight uppercase">MTC Book</span>
      <span class="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded font-mono border border-neutral-200">
        v{{ appVersion }}
      </span>

      <div class="h-4 w-[1px] bg-neutral-200 mx-1"></div>

      <SaveStatusIndicator :status="store.saveStatus" />

      <span v-if="currentFile" class="text-xs truncate max-w-[260px]"
        :class="autosavePaused || autosaveError ? 'text-amber-600 font-medium' : 'text-neutral-500'"
        :title="`File: ${currentFile.name}`">
        <i class="fa-solid fa-file-lines"></i> {{ currentFile.name }} · {{ fileLabel }}
      </span>
      <span v-else-if="platform.capabilities.nativeFiles && store.isBookLoaded" class="text-xs text-amber-600 font-medium truncate max-w-[260px]"
        title="Questo libro è solo nella copia interna: scegli un file con «Salva Lavoro» per attivare il salvataggio automatico">
        <i class="fa-solid fa-triangle-exclamation"></i> Nessun file associato
      </span>
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

      <button @click="openManual"
        class="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer"
        title="Manuale utente" aria-label="Manuale utente">
        <i class="fa-solid fa-circle-question"></i>
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

      <SaveSplitButton />
    </div>

    <SettingsModal :is-open="isSettingsOpen" @close="isSettingsOpen = false" />
    <PdfDesktopNotice />
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { platform } from '../platform'
import { autosaveError, autosavePaused, useBookFileActions } from '../composables/useBookFileActions'
import { useChessBookStore } from '../stores/chessBookStore'
import logo from '../assets/mtcbooks-logo.png'
import SettingsModal from './SettingsModal.vue'
import SaveStatusIndicator from './SaveStatusIndicator.vue'
import ExportSplitButton from './ExportSplitButton.vue'
import SaveSplitButton from './SaveSplitButton.vue'
import PdfDesktopNotice from './PdfDesktopNotice.vue'

const appVersion = __APP_VERSION__
const store = useChessBookStore()
const isSettingsOpen = ref(false)

// Sul web apre una nuova scheda; nel desktop il processo main la trasforma nella finestra del manuale
const openManual = () => window.open(`${import.meta.env.BASE_URL}manual/index.html`, '_blank', 'noopener')
const { handleNewBook, handleOpenFile } = useBookFileActions()
const currentFile = computed(() => platform.files.currentFile?.value ?? null)
const fileLabel = computed(() => {
  const f = currentFile.value
  if (!f) return ''
  if (autosavePaused.value) return 'salvataggio automatico sospeso'
  if (autosaveError.value) return 'ultimo salvataggio non riuscito'
  if (f.savedAt) return `salvato alle ${new Date(f.savedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
  return store.isLocked ? 'sola lettura' : 'aperto'
})
</script>