<template>
  <header class="h-14 bg-white border-b border-neutral-200 px-6 flex items-center justify-between shadow-sm shrink-0">
    <!-- Brand / Logo -->
    <div class="flex items-center gap-3">
      <div class="w-7 h-7 bg-black rounded flex items-center justify-center text-white font-serif font-black text-sm">
        M
      </div>
      <span class="text-md font-black text-neutral-950 tracking-tight uppercase">MTC Book</span>
      <span class="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded font-mono border border-neutral-200">
        v1.0.0
      </span>
    </div>

    <!-- Azioni Globali Documento (Placeholder per i salvataggi futuri) -->
    <div class="flex items-center gap-2">
      <button 
        class="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition"
      >
        Nuovo
      </button>
      <button 
        class="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition"
      >
        Apri...
      </button>

      <button 
        @click="store.triggerPdfExport()"
        class="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow transition mr-2 cursor-pointer"
      >
        Esporta PDF
      </button>

      <button 
        class="px-4 py-1.5 text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded shadow transition"
      >
        Salva Lavoro
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useChessBookStore } from '../stores/chessBookStore'
const store = useChessBookStore()
</script>