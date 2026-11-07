<template>
  <div class="inline-flex">
    <button ref="btn" type="button" @mousedown.prevent @click="toggle" v-tooltip="title"
      aria-haspopup="menu" :aria-expanded="open" :disabled="disabled"
      class="h-7 px-1.5 rounded text-xs transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
      :class="active || open ? 'bg-black text-white' : 'text-neutral-600 hover:bg-neutral-200 disabled:hover:bg-transparent'">
      <slot name="button" />
      <i class="fa-solid fa-chevron-down text-[8px] opacity-70"></i>
    </button>

    <!-- Nel body: la riga della toolbar può essere compressa con overflow nascosto e taglierebbe il menu -->
    <Teleport to="body">
      <template v-if="open">
        <div class="fixed inset-0 z-[60]" @mousedown.prevent="close"></div>
        <div ref="panel" role="menu"
          class="bg-white border border-neutral-200 rounded-lg shadow-lg py-1 font-sans fixed z-[61]"
          :class="panelClass" :style="pos">
          <slot :close="close" />
        </div>
      </template>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { vTooltip } from '../../directives/tooltip'

withDefaults(defineProps<{
  title: string
  active?: boolean
  disabled?: boolean
  panelClass?: string
}>(), { panelClass: 'min-w-44' })

const emit = defineEmits<{ (e: 'open'): void }>()

const open = ref(false)
const btn = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const pos = ref<Record<string, string>>({ top: '0px', left: '0px' })

const place = () => {
  const b = btn.value?.getBoundingClientRect()
  if (!b) return
  const w = panel.value?.offsetWidth ?? 0
  const left = Math.max(8, Math.min(b.left, window.innerWidth - w - 8))
  pos.value = { top: `${b.bottom + 4}px`, left: `${left}px` }
}

const close = () => { open.value = false }

const toggle = async () => {
  if (open.value) return close()
  open.value = true
  place()
  emit('open')
  await nextTick()
  place()   // seconda misura: ora il pannello esiste e ha una larghezza
}

watch(open, (isOpen, _old, onCleanup) => {
  if (!isOpen) return
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', close)
  onCleanup(() => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', close)
  })
})
</script>