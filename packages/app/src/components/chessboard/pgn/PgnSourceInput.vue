<template>
  <!-- 1. Sorgente -->
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <span class="text-[11px] font-medium text-neutral-500">1. Incolla il PGN o carica un file</span>
      <div class="flex items-center gap-3">
        <button v-if="text" class="text-[11px] font-semibold text-neutral-500 underline" @click="emit('clear')"
          v-tooltip.desc="'Svuota il PGN incollato e l\'elenco delle partite'">
          Pulisci
        </button>
        <button class="text-[11px] font-semibold text-neutral-700 underline" @click="fileInput?.click()"
          v-tooltip.desc="'Apre un file .pgn o .txt con una o più partite'">
          Carica file…
        </button>
      </div>
      <input ref="fileInput" type="file" accept=".pgn,.txt,text/plain" class="hidden" @change="onFile" />
    </div>
    <textarea v-model="text" rows="4" placeholder='1. e4 e5 2. Nf3 (2. f4 exf4) 2... Nc6 {commento}'
      class="w-full font-mono text-[11px] bg-neutral-50 border border-neutral-200 p-2 rounded focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none"></textarea>
    <p v-if="error" class="text-[11px] text-red-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { vTooltip } from '../../../directives/tooltip'

const text = defineModel<string>({ required: true })
defineProps<{ error?: string }>()
const emit = defineEmits<{ (e: 'file', file: File): void; (e: 'clear'): void }>()

const fileInput = ref<HTMLInputElement | null>(null)

const onFile = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('file', file)
  input.value = ''   // permette di riscegliere lo stesso file
}
</script>
