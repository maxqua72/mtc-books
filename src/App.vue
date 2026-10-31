<template>
  <div class="flex flex-col w-screen h-screen bg-neutral-50 th-main font-sans antialiased overflow-hidden">

    <!-- 1. Barra di Navigazione Superiore (Sempre Attiva) -->
    <AppHeader />

    <!-- 2. Condizione di Visualizzazione della UX -->
    <!-- Se il libro non è ancora inizializzato/aperto, mostra la Dashboard -->
    <WelcomeDashboard v-if="!bookStore.isBookLoaded" />

    <!-- Altrimenti, sblocca l'ambiente di lavoro completo a 3 Colonne -->
    <div v-else class="flex flex-1 overflow-hidden animate-fade-in">

      <!-- Colonna Sinistra (Nuova): Organizzatore dei capitoli -->
      <BookOrganizer />

      <!-- Colonna Centrale: Editor del Libro -->
      <main class="th-main flex-1 p-6 flex flex-col min-w-0 bg-neutral-50">
        <BookEditor />
      </main>

      <!-- Colonna Destra: Console di Supporto e Scacchiera -->
      <aside
        class="th-right w-[460px] bg-white border-l border-neutral-200 py-6 px-3 flex flex-col items-center justify-start overflow-y-auto shrink-0 no-print">
        <!-- <ChessBoard />  -->
        <!-- Sostituito ChessBoard con ChessboardController passandogli l'istanza dell'editor -->
        <ChessboardController />
      </aside>

    </div>
    <!-- Seconda scheda: scritture bloccate per non sovrascrivere il lavoro dell'altra -->
    <div v-if="!hasWriteLock"
      class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 class="text-lg font-semibold text-neutral-900">MTC Book è già aperto in un'altra scheda</h3>
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
import ChessboardController from './components/ChessboardController.vue'
import { useChessBookStore } from './stores/chessBookStore'
import { useChessTreeStore } from './stores/chessTreeStore'
import { platform } from './platform'

const bookStore = useChessBookStore()
const treeStore = useChessTreeStore()

const AUTOSAVE_DELAY = 800
const RETRY_MAX_DELAY = 30_000

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
}

// ---------------------------------------------------------------------------
// Uscita dalla pagina
// ---------------------------------------------------------------------------
// visibilitychange è l'unico evento affidabile su mobile; pagehide copre la chiusura.
// activeSectionHtml è già aggiornato a ogni digitazione (onUpdate): non serve forzare la sincronizzazione.
const onVisibility = () => { if (document.visibilityState === 'hidden') void saveNow() }
const onPageHide = () => { void saveNow() }

const onBeforeUnload = (e: BeforeUnloadEvent) => {
  if (!hasUnpersisted()) return
  void saveNow()   // se l'utente resta, il salvataggio parte comunque
  e.preventDefault()
  e.returnValue = ''
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('beforeunload', onBeforeUnload)

  await acquireWriteLock()
  if (!hasWriteLock.value) return   // scheda secondaria: il riquadro blocca tutto, non si legge né si scrive

  // Chiede al browser di non sfrattare IndexedDB (può essere negato: non è un errore)
  void navigator.storage?.persist?.().catch(() => { })

  await bookStore.restoreFromIndexedDB()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
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