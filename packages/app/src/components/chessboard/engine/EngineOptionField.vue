<template>
  <div class="space-y-0.5">
    <div v-if="option.type !== 'button'" class="flex items-center justify-between gap-2">
      <label :for="id" class="text-[11px] font-medium text-neutral-600" :title="tooltip">{{ label }}</label>
      <button v-if="changed" type="button" @click="restore" title="Ripristina il valore predefinito"
        class="text-[10px] text-neutral-400 hover:text-neutral-800">↺ predefinito</button>
    </div>

    <input v-if="option.type === 'check'" :id="id" type="checkbox" :checked="option.value === 'true'" @change="commit" />

    <input v-else-if="option.type === 'spin'" :id="id" type="number" step="1" :min="option.min ?? undefined"
      :max="option.max ?? undefined" :value="option.value ?? ''" @change="commit"
      class="w-full text-xs border border-neutral-200 rounded px-2 py-1 bg-white" />

    <select v-else-if="option.type === 'combo'" :id="id" :value="option.value ?? ''" @change="commit"
      class="w-full text-xs border border-neutral-200 rounded px-2 py-1 bg-white">
      <option v-for="v in option.vars" :key="v" :value="v">{{ v }}</option>
    </select>

    <input v-else-if="option.type === 'string'" :id="id" type="text" :value="option.value ?? ''" @change="commit"
      class="w-full font-mono text-[11px] border border-neutral-200 rounded px-2 py-1 bg-white" />

    <button v-else type="button" @click="press"
      class="w-full py-1 text-[11px] font-semibold border border-neutral-300 rounded hover:bg-neutral-100 transition">
      {{ label }}
    </button>

    <p v-if="hint" class="text-[10px] text-neutral-500 leading-snug">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import type { EngineOption } from '@mtc/shared'
import { useEngineStore } from '../../../stores/engineStore'

const props = defineProps<{ option: EngineOption; label: string; hint?: string }>()
const engine = useEngineStore()

const id = computed(() => `engine-opt-${props.option.name.replace(/\W+/g, '-')}`)
const changed = computed(() => props.option.default !== null && props.option.value !== props.option.default)
const tooltip = computed(() => {
  const o = props.option
  const parts = [o.name]
  if (o.type === 'spin') parts.push(`da ${o.min} a ${o.max}`)
  if (o.default !== null) parts.push(`predefinito: ${o.default === '' ? '(vuoto)' : o.default}`)
  return parts.join(' · ')
})

// Il campo mostra sempre il valore del motore: se è stato corretto o rifiutato, il testo digitato sparisce
async function commit(event: Event) {
  const el = event.target as HTMLInputElement | HTMLSelectElement
  const checkbox = el instanceof HTMLInputElement && el.type === 'checkbox'
  const value = checkbox ? String((el as HTMLInputElement).checked) : el.value
  await engine.setOption(props.option.name, value)
  await nextTick()
  if (checkbox) (el as HTMLInputElement).checked = props.option.value === 'true'
  else el.value = props.option.value ?? ''
}

const restore = () => void engine.setOption(props.option.name, props.option.default ?? '')
const press = () => void engine.pressButton(props.option.name)
</script>