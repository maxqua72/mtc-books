<template>
  <div class="flex flex-col w-screen h-screen bg-neutral-50 th-main font-sans antialiased overflow-hidden">

    <!-- 1. Barra di Navigazione Superiore (Sempre Attiva) -->
    <AppHeader />

    <!-- 2. Condizione di Visualizzazione della UX -->
    <!-- Se il libro non è ancora inizializzato/aperto, mostra la Dashboard -->
    <WelcomeDashboard v-if="!bookStore.isBookLoaded" />

    <!-- Altrimenti, sblocca l'ambiente di lavoro completo a 3 Colonne -->
    <div v-else class="flex flex-1 overflow-hidden animate-fade-in">

      <!-- Colonna Sinistra: Organizzatore dei capitoli (ridotta, resta una striscia che la riapre) -->
      <BookOrganizer />
      <PanelStrip v-if="collapsedPanels.sections" side="left" icon="fa-list-ul" label="Mostra le sezioni"
        @expand="setPanelCollapsed('sections', false)" />

      <!-- Colonna Centrale: Editor del Libro -->
      <main class="th-main flex-1 p-6 flex flex-col min-w-0 bg-neutral-50">
        <BookEditor />
      </main>

      <!-- Colonna Destra: Console di Supporto e Scacchiera.
           v-show: ridotta a striscia resta montata, così l'analisi del motore e la posizione non si perdono -->
      <aside v-show="!collapsedPanels.board"
        class="th-right w-[460px] bg-white border-l border-neutral-200 pt-2 pb-6 px-3 flex flex-col items-center justify-start overflow-y-auto shrink-0 no-print">
        <!-- Riga dei comandi della colonna, larga come la scacchiera: c'è posto per altri pulsanti -->
        <div class="w-[400px] h-7 mb-2 flex items-center gap-1 shrink-0">
          <button @click="setPanelCollapsed('board', true)" aria-label="Nascondi la scacchiera"
            class="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
            v-tooltip="'Nascondi la scacchiera'">
            <i class="fa-solid fa-angles-right text-xs"></i>
          </button>
        </div>
        <ChessboardController />
      </aside>
      <PanelStrip v-if="collapsedPanels.board" side="right" icon="fa-chess-board" label="Mostra la scacchiera"
        @expand="setPanelCollapsed('board', false)" />

    </div>
    <!-- Seconda scheda: scritture bloccate per non sovrascrivere il lavoro dell'altra -->
    <div v-if="!hasWriteLock"
      class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 class="text-lg font-semibold text-neutral-900">MTC Books è già aperto in un'altra scheda</h3>
        <p class="text-sm text-neutral-600">
          Lavorare su due schede contemporaneamente farebbe sovrascrivere il salvataggio dell'una all'altra.
          Chiudi questa scheda, oppure usa questa e l'altra smetterà di salvare.
        </p>
        <div class="flex justify-end">
          <button @click="takeOverThisTab"
            class="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition cursor-pointer">
            Usa questa scheda
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import WelcomeDashboard from './components/WelcomeDashboard.vue'
import BookOrganizer from './components/BookOrganizer.vue'
import BookEditor from './components/BookEditor.vue'
import { useSpellcheckStore } from './stores/spellcheckStore'
import ChessboardController from './components/ChessboardController.vue'
import { useChessBookStore } from './stores/chessBookStore'
import { useChessTreeStore } from './stores/chessTreeStore'
import { platform } from './platform'
import { useBookFileActions } from './composables/useBookFileActions'
import { useFileAutosave } from './composables/useFileAutosave'
import PanelStrip from './components/PanelStrip.vue'
import { collapsedPanels, setPanelCollapsed } from './utils/panelPreference'
import { vTooltip } from './directives/tooltip'

const bookStore = useChessBookStore()
const treeStore = useChessTreeStore()

const AUTOSAVE_DELAY = 800
const RETRY_MAX_DELAY = 30_000

const fileAutosave = useFileAutosave(() => hasWriteLock.value)

// ---------------------------------------------------------------------------
// Una sola scheda può scrivere: due schede sulla stessa IndexedDB si sovrascriverebbero
// ---------------------------------------------------------------------------
const hasWriteLock = ref(true)

/** Con steal si prende il lock a un'altra scheda; resta occupato finché la scheda è aperta. */
async function acquireWriteLock(steal = false): Promise<void> {
  hasWriteLock.value = await platform.session.acquireWriteLock({
    steal,
    onLost: () => { hasWriteLock.value = false },   // un'altra scheda ce l'ha tolto
  })
}

const takeOverThisTab = async () => {
  await acquireWriteLock(true)
  location.reload()   // si riparte da ciò che l'altra scheda ha scritto in IndexedDB
}

// ---------------------------------------------------------------------------
// Autosave con contatore di revisioni
// ---------------------------------------------------------------------------
let dirtyRev = 0          // cresce a ogni modifica
let savedRev = 0          // ultima revisione scritta con certezza
let saving: Promise<void> | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let retryDelay = 0
let quotaWarned = false

const hasUnpersisted = () =>
  hasWriteLock.value && bookStore.isBookLoaded && (dirtyRev !== savedRev || saving !== null)

const scheduleSave = (delay: number) => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => { void saveNow() }, delay)
}

async function saveNow(): Promise<void> {
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null }
  if (saving) await saving   // una scrittura alla volta
  if (!hasWriteLock.value || !bookStore.isBookLoaded || dirtyRev === savedRev) return

  const rev = dirtyRev   // la fotografia dello stato si prende in modo sincrono all'inizio di persistToIndexedDB
  bookStore.saveStatus = 'saving'
  let failed = false

  saving = (async () => {
    try {
      await bookStore.persistToIndexedDB({ refreshDirty: true })
      savedRev = rev
      retryDelay = 0
    } catch (e) {
      failed = true
      console.error('[autosave]', e)
      if ((e as DOMException)?.name === 'QuotaExceededError' && !quotaWarned) {
        quotaWarned = true
        alert('Spazio del browser esaurito: il lavoro non viene più salvato automaticamente. Usa «Salva Lavoro» per scaricare il file .mtcbook.')
      }
      retryDelay = Math.min(RETRY_MAX_DELAY, (retryDelay || 1000) * 2)
    }
  })()
  await saving
  saving = null

  // «saved» solo se nel frattempo non è arrivato altro
  bookStore.saveStatus = dirtyRev === savedRev ? 'saved' : 'unsaved'
  if (failed) scheduleSave(retryDelay)
  else if (dirtyRev !== savedRev) scheduleSave(AUTOSAVE_DELAY)

  fileAutosave.touch()   // salvataggio su file: 30 s dopo l'ultima modifica (solo desktop)
}

// ---------------------------------------------------------------------------
// Uscita dalla pagina
// ---------------------------------------------------------------------------
// visibilitychange è l'unico evento affidabile su mobile; pagehide copre la chiusura.
// activeSectionHtml è già aggiornato a ogni digitazione (onUpdate): non serve forzare la sincronizzazione.
const onVisibility = () => { if (document.visibilityState === 'hidden') void saveNow() }
const onPageHide = () => { void saveNow() }
let unsubscribeExternalOpen: (() => void) | null = null

const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (!hasUnpersisted()) return
  void saveNow()   // se l'utente resta, il salvataggio parte comunque
  e.preventDefault()
  e.returnValue = ''
}

onMounted(async () => {
  void useSpellcheckStore().init()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('beforeunload', onBeforeUnload)

  await acquireWriteLock()
  if (!hasWriteLock.value) return   // scheda secondaria: il riquadro blocca tutto, non si legge né si scrive

  // Chiede al browser di non sfrattare IndexedDB (può essere negato: non è un errore)
  void navigator.storage?.persist?.().catch(() => { })

  const { openPicked, reconnectLastFile } = useBookFileActions()
  if (await bookStore.restoreFromIndexedDB()) await reconnectLastFile()
  unsubscribeExternalOpen = platform.files.onExternalOpen?.(openPicked) ?? null
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  unsubscribeExternalOpen?.()
})

// --- WATCHER GLOBALE UNIFICATO ---
watch(
  [
    () => bookStore.activeSectionHtml,
    () => bookStore.metadata,
    () => bookStore.sectionIndex,
    () => treeStore.trees,
    () => bookStore.coverModel
  ],
  () => {
    // Sola lettura: niente autosave e nessuna modifica da segnalare
    if (bookStore.isLocked || !hasWriteLock.value) return

    dirtyRev++
    bookStore.saveStatus = 'unsaved'
    scheduleSave(AUTOSAVE_DELAY)   // il timer salva anche se nel frattempo il documento viene bloccato
  },
  { deep: true }
)
</script>

<style>
/* Semplice transizione fluida per l'apparizione dell'interfaccia */
.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.99);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>