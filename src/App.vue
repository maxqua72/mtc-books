<template>
  <div class="flex flex-col w-screen h-screen bg-neutral-50 font-sans antialiased overflow-hidden">
    
    <!-- 1. Barra di Navigazione Superiore (Sempre Attiva) -->
    <AppHeader />

    <!-- 2. Condizione di Visualizzazione della UX -->
    <!-- Se il libro non è ancora inizializzato/aperto, mostra la Dashboard -->
    <WelcomeDashboard v-if="!store.isBookLoaded" />

    <!-- Altrimenti, sblocca l'ambiente di lavoro completo a 3 Colonne -->
    <div v-else class="flex flex-1 overflow-hidden animate-fade-in">
      
      <!-- Colonna Sinistra (Nuova): Organizzatore dei capitoli -->
      <BookOrganizer />

      <!-- Colonna Centrale: Editor del Libro -->
      <main class="flex-1 p-6 flex flex-col min-w-0 bg-neutral-50">
        <BookEditor />
      </main>

      <!-- Colonna Destra: Console di Supporto e Scacchiera -->
      <aside class="w-[460px] bg-white border-l border-neutral-200 p-6 flex flex-col items-center justify-start overflow-y-auto shrink-0 no-print">
        <!-- <ChessBoard />  -->
        <!-- Sostituito ChessBoard con ChessboardController passandogli l'istanza dell'editor -->
        <ChessboardController />
      </aside>

    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
import WelcomeDashboard from './components/WelcomeDashboard.vue'
import BookOrganizer from './components/BookOrganizer.vue'
import BookEditor from './components/BookEditor.vue'
//import ChessBoard from './components/ChessBoard.vue'
import ChessboardController from './components/ChessboardController.vue'
import { useChessBookStore } from './stores/chessBookStore'

const store = useChessBookStore()
</script>

<style>
/* Semplice transizione fluida per l'apparizione dell'interfaccia */
.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.99); }
  to { opacity: 1; transform: scale(1); }
}
</style>