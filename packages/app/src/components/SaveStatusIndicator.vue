<template>
  <div class="flex items-center gap-1.5 text-xs transition-all duration-200 select-none">
    <!-- Salvataggio in corso -->
    <template v-if="status === 'saving'">
      <svg class="w-3.5 h-3.5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
        </path>
      </svg>
      <span class="text-blue-600 font-medium">Salvataggio in corso...</span>
    </template>

    <!-- Tutte le modifiche salvate -->
    <template v-else-if="status === 'saved'">
      <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
      </svg>
      <span class="text-neutral-500 font-normal">Salvataggio completato</span>
    </template>

    <!-- Modifiche in attesa di salvataggio (debounce) -->
    <template v-else-if="status === 'unsaved'">
      <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
      <span class="text-amber-600 font-medium">Modifiche non salvate</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SaveStatus } from '../stores/chessBookStore'

defineProps<{ status: SaveStatus }>()
</script>
