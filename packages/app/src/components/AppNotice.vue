<template>
  <!-- Sempre nel DOM: i lettori di schermo annunciano i messaggi che compaiono in una regione già presente -->
  <div role="status" aria-live="polite"
    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] pointer-events-none no-print">
    <div v-if="notice" :key="notice.id"
      class="pointer-events-auto flex items-center gap-4 max-w-[560px] px-4 py-2.5 rounded-lg shadow-lg bg-neutral-900 text-white text-xs">
      <div class="min-w-0">
        <p class="font-semibold">{{ notice.message }}</p>
        <p v-if="notice.detail" class="text-neutral-300 mt-0.5">{{ notice.detail }}</p>
      </div>
      <button v-if="notice.action" @click="noticeStore.runAction()"
        class="shrink-0 px-2 py-1 rounded font-bold uppercase tracking-wide text-amber-300 hover:bg-white/10 transition cursor-pointer">
        {{ notice.action.label }}
      </button>
      <button @click="noticeStore.dismiss()" aria-label="Chiudi l'avviso"
        class="shrink-0 w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNoticeStore } from '../stores/noticeStore'

const noticeStore = useNoticeStore()
const notice = computed(() => noticeStore.current)
</script>
