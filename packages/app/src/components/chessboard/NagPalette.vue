<template>
  <!-- Simboli di valutazione della mossa attiva: una riga per gruppo, etichetta a sinistra -->
  <div class="space-y-1">
    <div v-for="g in NAG_GROUPS" :key="g.id" class="flex items-start gap-2">
      <span :title="g.title"
        class="w-12 shrink-0 text-[10px] font-medium text-neutral-400 leading-6 truncate cursor-default">
        {{ SHORT_TITLES[g.id] }}
      </span>
      <div class="flex flex-wrap gap-0.5 min-w-0">
        <button v-for="n in g.items" :key="n.code" @click="emit('toggle', n.code)" v-tooltip="n.label"
          :aria-pressed="activeNags.includes(n.code)"
          class="min-w-[26px] h-6 px-1 rounded border text-[11px] font-bold transition"
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
import { NAG_GROUPS, type NagGroup } from '../../utils/nags'
import { vTooltip } from '../../directives/tooltip'

defineProps<{ activeNags: number[] }>()
const emit = defineEmits<{ (e: 'toggle', code: number): void }>()

// Etichette brevi per la colonna di sinistra; il titolo completo resta nel tooltip
const SHORT_TITLES: Record<NagGroup['id'], string> = {
  quality: 'Mossa',
  eval: 'Posiz.',
  other: 'Altro',
}
</script>