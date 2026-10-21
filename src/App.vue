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

const bookStore = useChessBookStore()
const treeStore = useChessTreeStore()

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave = false

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
    () => treeStore.trees,              // Nuove mosse, varianti, commenti o split sulla scacchiera
    () => bookStore.coverModel          // testi, posizioni, inquadratura, immagine
  ],
  () => {
    // Sola lettura: niente autosave e nessuna modifica da segnalare (anche gli spostamenti tra capitoli fanno scattare il watcher)
    if (bookStore.isLocked) return

    // Appena l'utente modifica qualcosa, segnamo che ci sono modifiche pendenti
    bookStore.saveStatus = 'unsaved'
    pendingSave = true

    // Se l'utente sta digitando o facendo azioni rapide, annulla il timer precedente
    if (autoSaveTimer) clearTimeout(autoSaveTimer)

    // Scrittura su IndexedDB solo dopo 800ms di inattività. Il timer salva anche se nel frattempo
    // il documento è stato bloccato: le modifiche fatte da sbloccato non devono andare perse.
    autoSaveTimer = setTimeout(async () => {
      if (!bookStore.isBookLoaded || !pendingSave) return
      pendingSave = false
      bookStore.saveStatus = 'saving'
      try {
        await bookStore.persistToIndexedDB({ refreshDirty: true })
        bookStore.saveStatus = 'saved'
      } catch (e) {
        console.error(e)
        bookStore.saveStatus = 'unsaved'
        pendingSave = true
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