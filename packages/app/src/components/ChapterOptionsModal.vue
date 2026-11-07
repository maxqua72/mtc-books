<template>
  <BaseModal :is-open="isOpen" labelledby="chapter-options-title" @close="emit('close')">
    <div class="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
      <h3 id="chapter-options-title" class="text-lg font-semibold text-neutral-900">{{ isText ? 'Opzioni della sezione' : 'Opzioni del capitolo' }}</h3>
      <button @click="emit('close')" aria-label="Chiudi"
        class="text-neutral-400 hover:text-neutral-700 transition p-1 rounded-md hover:bg-neutral-100">✕</button>
    </div>

    <fieldset v-if="item" :disabled="store.isLocked" class="px-6 py-5 space-y-4 border-0 m-0 min-w-0">
      <p v-if="store.isLocked" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
        Documento in sola lettura: abilita le modifiche dall'intestazione per cambiare queste opzioni.
      </p>

      <label class="flex items-start gap-3 cursor-pointer select-none">
        <input type="checkbox" class="mt-0.5 h-4 w-4" :checked="linked"
          @change="store.setSyncTitle(item.id, ($event.target as HTMLInputElement).checked)" />
        <div>
          <span class="text-sm font-medium text-neutral-800">Nome uguale al primo titolo</span>
          <p class="text-xs text-neutral-400">
            Il nome nell'elenco delle sezioni segue il testo del primo «Titolo 1». Se lo disattivi,
            il nome resta quello che scegli tu.
          </p>
        </div>
      </label>

      <div>
        <label class="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">{{ isText ? 'Nome della sezione' : 'Nome del capitolo' }}</label>
        <input type="text" :value="item.title" :disabled="linked" @change="rename"
          class="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 disabled:opacity-60" />
        <p v-if="linked" class="text-xs text-neutral-400 mt-1">Modificabile solo con il collegamento disattivato.</p>
      </div>
    </fieldset>

    <div class="border-t border-neutral-200 px-6 py-3 flex justify-end">
      <button @click="emit('close')"
        class="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition">
        Chiudi
      </button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import BaseModal from './BaseModal.vue'

const props = defineProps<{ isOpen: boolean; sectionId: string | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useChessBookStore()
const item = computed(() => store.sectionIndex.find(s => s.id === props.sectionId) ?? null)
const linked = computed(() => item.value?.syncTitle !== false)
const isText = computed(() => item.value?.type === 'text')

const rename = (e: Event) => {
  const value = (e.target as HTMLInputElement).value.trim()
  if (item.value && value) item.value.title = value.slice(0, 200)
  else (e.target as HTMLInputElement).value = item.value?.title ?? ''   // vuoto: si ripristina
}
</script>