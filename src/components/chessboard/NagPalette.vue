<template>
  <!-- Simboli di valutazione della mossa attiva -->
  <div class="space-y-1.5">
    <div v-for="g in NAG_GROUPS" :key="g.id">
      <div class="text-[10px] font-medium text-neutral-400 mb-0.5">{{ g.title }}</div>
      <div class="flex flex-wrap gap-1">
        <button v-for="n in g.items" :key="n.code" @click="emit('toggle', n.code)" :title="n.label"
          :aria-pressed="activeNags.includes(n.code)"
          class="min-w-[32px] h-7 px-1.5 rounded border text-xs font-bold transition"
          :class="activeNags.includes(n.code)
            ? 'bg-neutral-900 border-neutral-900 text-white'
            : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100'">
          {{ n.symbol }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NAG_GROUPS } from '../../utils/nags'

defineProps<{ activeNags: number[] }>()
const emit = defineEmits<{ (e: 'toggle', code: number): void }>()
</script>
