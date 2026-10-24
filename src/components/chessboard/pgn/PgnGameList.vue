<template>
  <!-- 2. Partite del file -->
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <span class="text-[11px] font-medium text-neutral-500">
        2. Partite nel file ({{ selectedCount }}/{{ games.length }} selezionate)
      </span>
      <button v-if="games.length > 1" class="text-[11px] font-semibold text-neutral-700 underline"
        @click="emit('toggleAll')">
        {{ allSelected ? 'Deseleziona tutte' : 'Seleziona tutte' }}
      </button>
    </div>

    <ul class="max-h-48 overflow-y-auto rounded border border-neutral-200 bg-neutral-50 divide-y divide-neutral-200">
      <li v-for="g in games" :key="g.index" class="px-2 py-1.5 text-[11px]">
        <label class="flex items-start gap-2" :class="g.problem ? 'opacity-70' : 'cursor-pointer'">
          <input type="checkbox" class="mt-0.5" :value="g.index" v-model="selected" :disabled="!!g.problem" />
          <div class="min-w-0">
            <div class="font-semibold text-neutral-700 truncate">
              {{ g.title }}<span v-if="g.result" class="font-normal text-neutral-500"> ({{ g.result }})</span>
            </div>
            <div v-if="g.problem" class="text-red-600">{{ g.problem }}</div>
            <div v-else-if="previews.get(g.index)" class="text-neutral-500">
              {{ previews.get(g.index)!.moves }} mosse · {{ previews.get(g.index)!.variations }} varianti ·
              {{ previews.get(g.index)!.comments }} commenti
            </div>
          </div>
        </label>
      </li>
    </ul>

    <p v-if="emptyCount" class="text-[11px] text-amber-700">
      {{ emptyCount }} {{ emptyCount === 1 ? 'partita senza mosse ignorata' : 'partite senza mosse ignorate' }}.
    </p>
    <ul v-if="singlePreview && singlePreview.warnings.length"
      class="text-[11px] text-amber-700 list-disc pl-4 space-y-0.5">
      <li v-for="w in singlePreview.warnings.slice(0, 3)" :key="w">{{ w }}</li>
      <li v-if="singlePreview.warnings.length > 3">… e altri {{ singlePreview.warnings.length - 3 }} avvisi</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { PgnGameInfo, ImportStats } from '../../../utils/pgnImport'

const selected = defineModel<number[]>('selected', { required: true })

defineProps<{
  games: PgnGameInfo[]
  selectedCount: number
  allSelected: boolean
  emptyCount?: number
  previews: Map<number, ImportStats>
  singlePreview: ImportStats | null
}>()

const emit = defineEmits<{ (e: 'toggleAll'): void }>()
</script>
