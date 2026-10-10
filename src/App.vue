<template>
  <div class="flex flex-col w-screen h-screen bg-neutral-50 font-sans antialiased overflow-hidden">

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
      <main class="flex-1 p-6 flex flex-col min-w-0 bg-neutral-50">
        <BookEditor />
      </main>

      <!-- Colonna Destra: Console di Supporto e Scacchiera -->
      <aside
        class="w-[460px] bg-white border-l border-neutral-200 py-6 px-3 flex flex-col items-center justify-start overflow-y-auto shrink-0 no-print">
        <!-- <ChessBoard />  -->
        <!-- Sostituito ChessBoard con ChessboardController passandogli l'istanza dell'editor -->
        <ChessboardController />
      </aside>

    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import WelcomeDashboard from './components/WelcomeDashboard.vue'
import BookOrganizer from './components/BookOrganizer.vue'
import BookEditor from './components/BookEditor.vue'
//import ChessBoard from './components/ChessBoard.vue'
import ChessboardController from './components/ChessboardController.vue'
import { useChessBookStore } from './stores/chessBookStore'
import { useChessTreeStore } from './stores/chessTreeStore'
import { saveFullStateToIndexedDB } from './db'

const bookStore = useChessBookStore()
const treeStore = useChessTreeStore()

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// --- RIPRISTINO ALL'AVVIO ---
onMounted(async () => {
  /*const bookRestored = await bookStore.restoreFromIndexedDB()
  if (bookRestored) {
    await treeStore.restoreFromIndexedDB()
  }*/
  await bookStore.restoreFromIndexedDB()
})

// --- WATCHER GLOBALE UNIFICATO ---
watch(
  [
    () => bookStore.activeSectionHtml, // Modifica di anche 1 singolo carattere nell'editor
    () => bookStore.metadata,           // Cambiamento di titolo, autore, margini, ecc.
    () => bookStore.sectionIndex,       // Aggiunta, riordino o eliminazione capitoli
    () => treeStore.trees              // Nuove mosse, varianti, commenti o split sulla scacchiera
  ],
  () => {
    // 1. Appena l'utente modifica qualcosa, segnamo che ci sono modifiche pendenti
    bookStore.saveStatus = 'unsaved'

    // 1. Se l'utente sta digitando o facendo azioni rapide, annulla il timer precedente
    if (autoSaveTimer) clearTimeout(autoSaveTimer)

    // 2. Avvia la scrittura su IndexedDB solo dopo 800ms di inattività
    autoSaveTimer = setTimeout(async () => {
      if (!bookStore.isBookLoaded) return
      bookStore.saveStatus = 'saving'
      try {
        bookStore.syncActiveSectionToCache()   // niente prune: l'autosave non cancella mai alberi
        await saveFullStateToIndexedDB(
          bookStore.metadata,
          bookStore.sectionIndex,
          bookStore.activeSectionId,
          bookStore.zippedSectionsCache
        )
        bookStore.saveStatus = 'saved'
      } catch (e) {
        console.error(e)
        bookStore.saveStatus = 'unsaved'
      }
    }, 800)
  },
  { deep: true } // Cruciale: ascolta anche le modifiche ad oggetti e array annidati
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