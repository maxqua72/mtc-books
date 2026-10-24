<template>
  <!-- Guscio comune dei modali: overlay, pannello, chiusura con Esc e clic sull'overlay.
       Header, corpo e piede li scrive ogni modale nello slot. -->
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans"
      :class="overlayClass" @mousedown.self="emit('close')">
      <div role="dialog" aria-modal="true" :aria-labelledby="labelledby"
        class="bg-white rounded-xl shadow-xl border border-neutral-200 w-full flex flex-col overflow-hidden"
        :class="[widthClass, panelClass]">
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue'

const props = withDefaults(defineProps<{
  isOpen: boolean
  labelledby?: string
  widthClass?: string
  panelClass?: string
  overlayClass?: string
}>(), {
  widthClass: 'max-w-md',
  panelClass: '',
  overlayClass: 'bg-black/30',
})
const emit = defineEmits<{ (e: 'close'): void }>()

// Il listener esiste solo mentre il modale è aperto
watch(() => props.isOpen, (open, _old, onCleanup) => {
  if (!open) return
  const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
  window.addEventListener('keydown', onKeydown)
  onCleanup(() => window.removeEventListener('keydown', onKeydown))
}, { immediate: true })
</script>
