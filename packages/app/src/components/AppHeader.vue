<template>
  <!-- Finestra stretta: a sinistra i testi si accorciano (min-w-0), a destra i comandi non si tagliano mai (shrink-0).
       Con la finestra larga si vedono tutti i testi; restringendo lasciano il posto alle icone un po' alla volta
       (regole in fondo al file: le classi responsive di Tailwind perdono contro le regole di Font Awesome) -->
  <header
    class="th-header h-14 bg-white border-b border-neutral-200 px-6 gap-3 flex items-center justify-between shadow-sm shrink-0">
    <!-- Brand / Logo -->
    <div class="flex items-center gap-3 min-w-0">
      <img :src="logo" alt="MTC Books" class="w-auto h-10 object-contain shrink-0" />
      <span class="hdr-brand text-md font-black text-neutral-950 tracking-tight uppercase whitespace-nowrap">MTC Books</span>
      <span class="hdr-version text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded font-mono border border-neutral-200">
        v{{ appVersion }}
      </span>

      <div class="h-4 w-[1px] bg-neutral-200 mx-1 shrink-0"></div>

      <!-- Senza libro non c'è niente di salvato: lo stato iniziale «salvato» sarebbe falso -->
      <SaveStatusButton v-if="store.isBookLoaded" />
    </div>

    <!-- Azioni Globali Documento -->
    <div class="flex items-center gap-2 shrink-0">
      <div class="flex items-center gap-0.5">
        <!-- Nella schermata iniziale c'è già «Crea un nuovo libro», che chiede titolo e autore -->
        <button v-if="store.isBookLoaded" @click="handleNewBook" aria-label="Nuovo"
          class="hdr-cmd px-2 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer">
          <span class="hdr-cmd-text">Nuovo</span>
          <i class="hdr-cmd-icon fa-solid fa-file-circle-plus" aria-hidden="true"></i>
        </button>

        <button @click="handleOpenFile" aria-label="Apri..."
          class="hdr-cmd px-2 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer">
          <span class="hdr-cmd-text">Apri...</span>
          <i class="hdr-cmd-icon fa-solid fa-folder-open" aria-hidden="true"></i>
        </button>
      </div>

      <div class="flex items-center gap-0.5">
        <button @click="isSettingsOpen = true" data-tour="settings"
          class="w-8 h-8 flex items-center justify-center text-base text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer"
          v-tooltip="'Impostazioni: aspetto dell\'applicazione'">
          <i class="fa-solid fa-gear"></i>
        </button>

        <button @click="openManual"
          class="w-8 h-8 flex items-center justify-center text-base text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer"
          v-tooltip="'Manuale utente'">
          <i class="fa-solid fa-circle-question"></i>
        </button>
      </div>

      <!-- Interruttore sola lettura / modifica -->
      <button v-if="store.isBookLoaded" @click="store.setLocked(!store.isLocked)" role="switch" data-tour="lock"
        :aria-checked="!store.isLocked"
        v-tooltip.desc="store.isLocked ? 'Documento in sola lettura: clic per abilitare le modifiche' : 'Modifiche abilitate: clic per bloccare il documento'"
        class="flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-semibold transition cursor-pointer select-none"
        :class="store.isLocked
          ? 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
          : 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100'">
        <span class="relative inline-block w-7 h-4 rounded-full transition-colors"
          :class="store.isLocked ? 'bg-neutral-300' : 'bg-amber-500'">
          <span class="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform"
            :class="store.isLocked ? '' : 'translate-x-3'"></span>
        </span>
        <span class="hdr-switch-text">{{ store.isLocked ? 'Sola lettura' : 'Modifica attiva' }}</span>
      </button>

      <!-- Senza libro l'esportazione non ha un editor e il salvataggio scriverebbe un file vuoto -->
      <div v-if="store.isBookLoaded" data-tour="file-actions" class="flex items-center gap-2">
        <ExportSplitButton />

        <SaveSplitButton />
      </div>
    </div>

    <SettingsModal :is-open="isSettingsOpen" @close="isSettingsOpen = false" />
    <PdfDesktopNotice />
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useBookFileActions } from '../composables/useBookFileActions'
import { useChessBookStore } from '../stores/chessBookStore'
import logo from '../assets/mtcbooks-logo.svg'
import { openManualPage } from '../utils/manualPage'
import SettingsModal from './SettingsModal.vue'
import SaveStatusButton from './SaveStatusButton.vue'
import ExportSplitButton from './ExportSplitButton.vue'
import SaveSplitButton from './SaveSplitButton.vue'
import PdfDesktopNotice from './PdfDesktopNotice.vue'
import { vTooltip } from '../directives/tooltip'

const appVersion = __APP_VERSION__
const store = useChessBookStore()
const isSettingsOpen = ref(false)

const openManual = () => openManualPage()
const { handleNewBook, handleOpenFile } = useBookFileActions()
</script>

<style scoped>
/* Restringendo la finestra, nell'ordine: sotto 1440 px via la versione; sotto 1280 px via il nome accanto al logo
   e Nuovo e Apri diventano icone (16 px, come impostazioni e manuale); sotto 1024 px l'interruttore perde il testo;
   sotto 860 px lo stato del salvataggio perde il testo e sotto 760 px anche il nome del file: resta l'icona.
   I testi tolti restano per i lettori di schermo (aria-label o testo nascosto solo alla vista) */
.hdr-cmd-icon { display: none; font-size: 16px; }

@media (max-width: 1439.98px) {
  .hdr-version { display: none; }
}

@media (max-width: 1279.98px) {
  .hdr-brand { display: none; }
  .hdr-cmd { width: 2rem; height: 2rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; }
  .hdr-cmd-text { display: none; }
  .hdr-cmd-icon { display: block; }
}

@media (max-width: 1023.98px) {
  .hdr-switch-text {
    position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
}

/* L'indicatore ha già un aria-label completo: i testi si possono togliere del tutto */
@media (max-width: 859.98px) {
  header :deep(.status-label) { display: none; }
}

@media (max-width: 759.98px) {
  header :deep(.status-file) { display: none; }
}
</style>
