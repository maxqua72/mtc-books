<template>
  <div @click="emit('select')"
    :draggable="draggable"
    @dragstart="emit('dragStart')"
    @dragend="emit('dragEnd')"
    @dragover.prevent="emit('dragOver')"
    @dragleave="emit('dragLeave')"
    @drop="emit('drop')"
    :class="[
      'group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer relative',
      active ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
      draggable ? 'cursor-grab active:cursor-grabbing' : '',
      dropClass
    ]">

    <div class="flex items-center gap-2 truncate">
      <!-- Icona di trascinamento visibile al passaggio del mouse sui capitoli -->
      <span v-if="draggable" class="opacity-0 group-hover:opacity-100 text-neutral-400 mr-0.5 cursor-grab">
        ⋮⋮
      </span>
      <span>{{ icon }}</span>
      <span class="truncate">{{ section.title }}</span>
    </div>

    <!-- Azioni rapide al passaggio del mouse -->
    <div v-if="!locked" class="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity pl-1 shrink-0">
      <button @click.stop="emit('rename')" class="p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-[10px]" title="Rinomina voce indice">
        ✏️
      </button>
      <button @click.stop="emit('remove')" class="p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-[10px]" title="Elimina sezione">
        🗑️
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SectionIndexItem } from '../stores/chessBookStore'

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
}>()

// Solo i capitoli si riordinano, e solo se il documento non è in sola lettura
const draggable = computed(() => props.section.type === 'chapter' && !props.locked)
const icon = computed(() => (props.section.type === 'cover' ? '📘' : props.section.type === 'index' ? '📋' : '📝'))
</script>
