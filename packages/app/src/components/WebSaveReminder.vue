<template>
  <!-- Solo web: il lavoro che non è nel file .mtcbook vive solo nel browser, che può cancellarlo -->
  <div v-if="visible" role="status"
    class="shrink-0 flex items-center gap-3 px-6 py-2 text-xs bg-amber-50 border-b border-amber-200 text-amber-900 no-print">
    <i class="fa-solid fa-triangle-exclamation text-amber-600" aria-hidden="true"></i>
    <span class="flex-1 min-w-0">
      Il lavoro è salvato solo in questo browser, che può cancellarlo con i dati di navigazione.
      Salvalo su file con «Salva Lavoro».
    </span>
    <button @click="save"
      class="px-3 py-1 font-semibold rounded bg-amber-600 hover:bg-amber-700 text-white transition cursor-pointer">
      Salva Lavoro
    </button>
    <button @click="later" class="px-2 py-1 font-semibold rounded hover:bg-amber-100 transition cursor-pointer">
      Più tardi
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { capabilities } from '../platform'
import { useChessBookStore } from '../stores/chessBookStore'
import { useBookFileActions } from '../composables/useBookFileActions'

// Quanto lavoro non salvato su file si tollera prima di ricordarlo, e dopo «Più tardi»
const REMIND_AFTER_MS = 5 * 60_000
const SNOOZE_MS = 15 * 60_000

const store = useChessBookStore()
const { handleSaveFile } = useBookFileActions()

const dirty = computed(() => !capabilities.nativeFiles && store.isBookLoaded && store.fileDirty)
const remindAt = ref<number | null>(null)
const now = ref(Date.now())

// Il conto riparte ogni volta che il file torna aggiornato
watch(dirty, d => { remindAt.value = d ? Date.now() + REMIND_AFTER_MS : null }, { immediate: true })

const timer = setInterval(() => { now.value = Date.now() }, 15_000)
onBeforeUnmount(() => clearInterval(timer))

const visible = computed(() => dirty.value && remindAt.value !== null && now.value >= remindAt.value)

const save = () => { void handleSaveFile() }
const later = () => { remindAt.value = Date.now() + SNOOZE_MS }
</script>
