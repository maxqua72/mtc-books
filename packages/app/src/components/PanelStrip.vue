<template>
  <!-- Colonna ridotta: tutta la striscia riapre la colonna -->
  <button type="button" @click="emit('expand')" v-tooltip="label" :aria-label="label" :aria-expanded="false"
    class="w-10 shrink-0 h-full flex flex-col items-center gap-3 pt-4 bg-white text-neutral-500 hover:text-neutral-900 transition cursor-pointer select-none no-print"
    :class="side === 'left' ? 'th-left border-r border-neutral-200' : 'th-right border-l border-neutral-200'">
    <i class="fa-solid text-xs" :class="side === 'left' ? 'fa-angles-right' : 'fa-angles-left'"></i>
    <i class="fa-solid text-base" :class="icon"></i>
  </button>
</template>

<script setup lang="ts">
import { vTooltip } from '../directives/tooltip'

defineProps<{ side: 'left' | 'right'; icon: string; label: string }>()
const emit = defineEmits<{ expand: [] }>()
</script>
