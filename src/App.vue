<template>
  <div class="flex flex-col w-screen h-screen bg-neutral-50 font-sans antialiased overflow-hidden">
    
    <!-- 1. Barra di Navigazione Superiore -->
    <AppHeader />

    <!-- 2. Area Principale di Lavoro Divisa in Due Colonne -->
    <div class="flex flex-1 overflow-hidden">
      
      <!-- Colonna Sinistra: Editor del Libro -->
      <main class="flex-1 p-6 flex flex-col min-w-0 bg-neutral-50">
        <BookEditor />
      </main>

      <!-- Colonna Destra: Console di Supporto e Scacchiera -->
      <aside class="w-[460px] bg-white border-l border-neutral-200 p-6 flex flex-col items-center justify-start overflow-y-auto shrink-0 no-print">
        <ChessBoard />
      </aside>

    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
import BookEditor from './components/BookEditor.vue'
import ChessBoard from './components/ChessBoard.vue'


</script>
