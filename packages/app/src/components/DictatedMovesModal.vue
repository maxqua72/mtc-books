<template>
  <BaseModal :is-open="isOpen" width-class="max-w-xl" labelledby="dictated-moves-title" @close="emit('close')">
    <div class="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
      <h3 id="dictated-moves-title" class="text-lg font-semibold text-neutral-900">Converti mosse</h3>
      <button @click="emit('close')" aria-label="Chiudi"
        class="text-neutral-400 hover:text-neutral-700 transition p-1 rounded-md hover:bg-neutral-100">✕</button>
    </div>

    <div class="px-6 py-4 max-h-[60vh] overflow-y-auto">
      <p class="text-xs text-neutral-500 mb-3">
        Togli la spunta alle voci da lasciare come sono.
      </p>
      <ul class="space-y-2">
        <li v-for="it in items" :key="it.id">
          <label class="flex items-start gap-3 cursor-pointer select-none rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
            <input type="checkbox" class="mt-1 h-4 w-4 shrink-0" :checked="checked.has(it.id)" @change="toggle(it.id)" />
            <div class="min-w-0 flex-1 text-sm">
              <p class="text-neutral-500 break-words">
                {{ it.before }}<mark class="bg-amber-100 text-neutral-900 rounded px-0.5">{{ it.original }}</mark>{{ it.after }}
              </p>
              <p class="mt-1 text-neutral-900 font-medium flex items-baseline gap-2">
                <i class="fa-solid fa-arrow-right text-[10px] text-neutral-400"></i>
                <span class="dictated-result" v-html="resultHtml(it.replacement)"></span>
              </p>
            </div>
          </label>
        </li>
      </ul>
    </div>

    <div class="border-t border-neutral-200 px-6 py-3 flex justify-end gap-2">
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium rounded-lg text-neutral-600 hover:bg-neutral-100 transition">
        Annulla
      </button>
      <button @click="emit('apply', [...checked])" :disabled="checked.size === 0"
        class="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition disabled:opacity-40 disabled:cursor-not-allowed">
        Applica
      </button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import { figurinizeHtml } from '../utils/figurines'
import type { DictatedMoveItem } from '../composables/useConvertDictatedMoves'

const props = defineProps<{ isOpen: boolean; items: DictatedMoveItem[] }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', ids: number[]): void
}>()

// Tutte le voci spuntate per default, a ogni apertura
const checked = ref(new Set<number>())
watch(() => props.items, (list) => { checked.value = new Set(list.map(i => i.id)) }, { immediate: true })

const toggle = (id: number) => {
  const next = new Set(checked.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  checked.value = next
}

// Il risultato come apparirà nel libro: lettere dei pezzi → figurine (la notazione contiene solo [A-Za-z0-9.=+#x -])
const resultHtml = (san: string) => figurinizeHtml(san.replace(/[^A-Za-z0-9.=+#\- ]/g, ''))
</script>

<style scoped>
.dictated-result :deep(.tgc-figurine) {
  font-family: 'Chess The Good Companions', sans-serif;
  font-weight: normal;
  font-size: 1.05em;
  line-height: 1;
  margin-right: 1px;
  vertical-align: 1px;
}

.dictated-result :deep(.chess-cases-figurine) {
  font-family: 'Chess Cases', sans-serif;
  font-weight: normal;
  font-size: 1.15em;
  line-height: 1;
  vertical-align: -3px;
}
</style>
