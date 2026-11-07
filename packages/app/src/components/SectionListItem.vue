<template>
  <div @click="emit('select')" :draggable="draggable" @dragstart="emit('dragStart')" @dragend="emit('dragEnd')"
    @dragover.prevent="emit('dragOver')" @dragleave="emit('dragLeave')" @drop="emit('drop')" :class="[
      'group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer relative',
      active ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
      draggable ? 'cursor-grab active:cursor-grabbing' : '',
      dropClass
    ]">

    <div class="flex items-center gap-2 truncate">
      <!-- Icona di trascinamento visibile al passaggio del mouse sui capitoli -->
      <span v-if="draggable" :class="[
        'opacity-0 group-hover:opacity-100 mr-0.5 cursor-grab transition-opacity',
        active ? 'text-neutral-400' : 'text-neutral-400'
      ]">
        <i class="fa-solid fa-grip-vertical text-[10px]"></i>
      </span>

      <!-- Icona della sezione (mappata con Font Awesome e colore dinamico) -->
      <span class="shrink-0 flex items-center justify-center w-4 text-center">
        <i :class="iconClass"></i>
      </span>

      <span class="truncate">{{ section.title }}</span>
    </div>

    <!-- Azioni rapide al passaggio del mouse -->
    <div v-if="!locked"
      class="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity pl-1 shrink-0">

      <!-- Opzioni del capitolo -->
      <button v-if="section.type === 'chapter'" @click.stop="emit('options')" :class="[
        'w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors',
        active ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900'
      ]" v-tooltip="'Opzioni del capitolo'">
        <i class="fa-solid fa-sliders text-[9px]"></i>
      </button>

      <!-- Rinomina -->
      <button @click.stop="emit('rename')" :class="[
        'w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors',
        active ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900'
      ]" v-tooltip="'Rinomina voce indice'">
        <i class="fa-solid fa-pen text-[9px]"></i>
      </button>

      <!-- Elimina -->
      <button @click.stop="emit('remove')" :class="[
        'w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors',
        active ? 'hover:bg-neutral-800 text-red-400 hover:text-red-300' : 'hover:bg-neutral-200 text-neutral-500 hover:text-red-600'
      ]" v-tooltip="'Elimina sezione'">
        <i class="fa-solid fa-trash text-[9px]"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SectionIndexItem } from '../stores/chessBookStore'
import { vTooltip } from '../directives/tooltip'

const props = defineProps<{
  section: SectionIndexItem
  active: boolean
  locked: boolean
  dropClass: string
}>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'rename'): void
  (e: 'remove'): void
  (e: 'dragStart'): void
  (e: 'dragEnd'): void
  (e: 'dragOver'): void
  (e: 'dragLeave'): void
  (e: 'drop'): void
  (e: 'options'): void
}>()

// Solo i capitoli si riordinano, e solo se il documento non è in sola lettura
const draggable = computed(() => props.section.type === 'chapter' && !props.locked)

// Calcola le classi CSS (Icona + Colore) in base a tipo, stato attivo e locked
const iconClass = computed(() => {
  // 1. Determina il tipo di icona
  let baseIcon = 'fa-solid fa-file-lines'
  if (props.section.type === 'cover') baseIcon = 'fa-solid fa-book-open'
  if (props.section.type === 'index') baseIcon = 'fa-solid fa-list-ol'

  // 2. Determina la classe di colore
  let colorClass = 'text-neutral-700 group-hover:text-neutral-900' // Sbloccato (Scuro/Nero)
  if (props.active) {
    colorClass = 'text-white' // Riga Attiva (Bianco ad alto contrasto)
  } else if (props.locked) {
    colorClass = 'text-neutral-400' // Bloccato (Grigio)
  }

  return `${baseIcon} ${colorClass}`
})
</script>
