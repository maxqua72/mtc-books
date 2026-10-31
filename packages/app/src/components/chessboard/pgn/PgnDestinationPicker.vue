<template>
  <!-- 3. Destinazione -->
  <div class="space-y-2">
    <span class="text-[11px] font-medium text-neutral-500">3. Dove va inserito</span>

    <label class="block rounded border px-2 py-1.5 cursor-pointer"
      :class="mode === 'new-tree' ? 'border-neutral-900 bg-white' : 'border-neutral-200'">
      <div class="flex items-center gap-2 text-xs font-semibold">
        <input type="radio" value="new-tree" v-model="mode" />
        {{ selectedCount > 1 ? 'Nuovi alberi di mosse (uno per partita)' : 'Nuovo albero di mosse' }}
      </div>
      <div v-if="mode === 'new-tree'" class="mt-1.5 space-y-1">
        <select v-model="placement" class="w-full text-xs border border-neutral-200 rounded px-2 py-1">
          <option value="after-active" :disabled="!afterActiveAvailable">Dopo l’albero attivo</option>
          <option value="cursor">Dopo il punto in cui si trova il cursore</option>
          <option value="end">In fondo al capitolo</option>
        </select>
        <p class="text-[11px] text-blue-700">
          {{ selectedCount > 1 ? `Verranno creati ${selectedCount} blocchi` : 'Verrà creato un nuovo blocco' }}
          {{ placementLabel }}. Il punto è segnato nel documento.
        </p>
      </div>
    </label>

    <label class="block rounded border px-2 py-1.5"
      :class="[mode === 'into-active' ? 'border-neutral-900 bg-white' : 'border-neutral-200',
               intoActiveReason ? 'opacity-60' : 'cursor-pointer']">
      <div class="flex items-center gap-2 text-xs font-semibold">
        <input type="radio" value="into-active" v-model="mode" :disabled="!!intoActiveReason" />
        Aggiungi all’albero attivo
      </div>
      <p class="mt-1 text-[11px]" :class="intoActiveReason ? 'text-neutral-500' : 'text-blue-700'">
        {{ intoActiveReason || intoActiveText }}
      </p>
    </label>
  </div>
</template>

<script setup lang="ts">
import type { PgnImportMode, PgnPlacement } from '../../../stores/pgnImportStore'

const mode = defineModel<PgnImportMode>('mode', { required: true })
const placement = defineModel<PgnPlacement>('placement', { required: true })

defineProps<{
  selectedCount: number
  afterActiveAvailable: boolean
  placementLabel: string
  intoActiveReason: string | null
  intoActiveText: string
}>()
</script>
