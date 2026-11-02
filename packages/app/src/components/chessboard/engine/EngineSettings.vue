<template>
  <details open class="rounded border border-neutral-200">
    <summary class="px-2 py-1.5 text-[11px] font-semibold text-neutral-700 cursor-pointer select-none">Impostazioni del motore</summary>
    <div class="p-2 space-y-2.5">
      <p v-for="w in warnings" :key="w" class="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">{{ w }}</p>

      <EngineOptionField v-for="o in featured" :key="o.name" :option="o" :label="labelOf(o)" :hint="hintOf(o)" />

      <div class="flex gap-2">
        <button type="button" @click="applyRecommended"
          class="flex-1 py-1 text-[11px] font-semibold border border-neutral-300 rounded hover:bg-neutral-100 transition"
          :title="`Thread: ${recommended.threads}, hash: ${recommended.hash} MB`">Valori consigliati</button>
        <button type="button" @click="engine.resetOptions()"
          class="flex-1 py-1 text-[11px] font-semibold border border-neutral-300 rounded hover:bg-neutral-100 transition">Ripristina predefiniti</button>
      </div>

      <details v-if="engine.advancedOptions.length">
        <summary class="text-[11px] font-medium text-neutral-500 cursor-pointer select-none">Avanzate ({{ engine.advancedOptions.length }})</summary>
        <p class="text-[10px] text-amber-700 mt-1">Modifica «EvalFile», «EvalFileSmall» e «Debug Log File» solo se sai cosa stai facendo.</p>
        <div class="space-y-2 mt-2">
          <EngineOptionField v-for="o in engine.advancedOptions" :key="o.name" :option="o" :label="o.name" />
        </div>
      </details>

      <div class="border-t border-neutral-200 pt-2 space-y-2">
        <span class="text-[11px] font-semibold text-neutral-600">Analisi</span>

        <label class="block text-[11px] text-neutral-600">Modalità
          <select :value="engine.prefs.mode" class="w-full text-xs border border-neutral-200 rounded px-2 py-1 bg-white"
            @change="engine.setPrefs({ mode: ($event.target as HTMLSelectElement).value as SearchMode })">
            <option value="infinite">Continua finché non cambi posizione</option>
            <option value="depth">Fino a una profondità</option>
            <option value="time">Per un tempo fisso</option>
          </select>
        </label>

        <label v-if="engine.prefs.mode === 'depth'" class="block text-[11px] text-neutral-600">Profondità (1–99)
          <input type="number" min="1" max="99" :value="engine.prefs.depth" class="w-full text-xs border border-neutral-200 rounded px-2 py-1 bg-white"
            @change="engine.setPrefs({ depth: Number(($event.target as HTMLInputElement).value) })" />
        </label>

        <label v-if="engine.prefs.mode === 'time'" class="block text-[11px] text-neutral-600">Tempo per posizione (secondi)
          <input type="number" min="0.1" max="600" step="0.5" :value="engine.prefs.timeMs / 1000" class="w-full text-xs border border-neutral-200 rounded px-2 py-1 bg-white"
            @change="engine.setPrefs({ timeMs: Math.round(Number(($event.target as HTMLInputElement).value) * 1000) })" />
        </label>

        <label class="flex items-center gap-2 text-[11px] text-neutral-600">
          <input type="checkbox" :checked="engine.prefs.showArrow"
            @change="engine.setPrefs({ showArrow: ($event.target as HTMLInputElement).checked })" />
          Freccia della mossa migliore sulla scacchiera
        </label>
        <label class="flex items-center gap-2 text-[11px] text-neutral-600">
          <input type="checkbox" :checked="engine.prefs.autoStart"
            @change="engine.setPrefs({ autoStart: ($event.target as HTMLInputElement).checked })" />
          Avvia il motore all'apertura dell'app
        </label>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EngineOption, SearchMode } from '@mtc/shared'
import { useEngineStore } from '../../../stores/engineStore'
import EngineOptionField from './EngineOptionField.vue'

const engine = useEngineStore()

const ORDER = ['multipv', 'threads', 'hash', 'skill level', 'uci_limitstrength', 'uci_elo', 'syzygypath']
const LABELS: Record<string, string> = {
  multipv: 'Numero di linee',
  threads: 'Thread (processori)',
  hash: 'Memoria hash (MB)',
  'skill level': 'Livello di abilità (0–20)',
  uci_limitstrength: 'Limita la forza di gioco',
  uci_elo: 'Elo (con forza limitata)',
  syzygypath: 'Cartella delle tabelle Syzygy',
}
const HINTS: Record<string, string> = {
  uci_elo: 'Ha effetto solo con «Limita la forza di gioco» attivo.',
  syzygypath: 'Facoltativa: percorso delle tabelle di finale.',
}

const key = (o: EngineOption) => o.name.toLowerCase()
const featured = computed(() =>
  [...engine.featuredOptions].sort((a, b) => ORDER.indexOf(key(a)) - ORDER.indexOf(key(b))))
const labelOf = (o: EngineOption) => LABELS[key(o)] ?? o.name
const hintOf = (o: EngineOption) => HINTS[key(o)]

const valueOf = (name: string) => Number(engine.options.find((o) => key(o) === name)?.value)

const warnings = computed(() => {
  const out: string[] = []
  const { cpus, memoryMb } = engine.system
  const threads = valueOf('threads')
  const hash = valueOf('hash')
  if (threads > cpus) out.push(`Hai ${threads} thread ma il computer ha ${cpus} processori logici: conviene non superarli.`)
  if (hash > memoryMb / 2) out.push(`La memoria hash (${hash} MB) supera metà della RAM (${memoryMb} MB): il computer potrebbe rallentare.`)
  return out
})

// Proposta prudente: un processore libero per l'interfaccia e un ottavo della RAM per l'hash
const recommended = computed(() => {
  const { cpus, memoryMb } = engine.system
  let hash = 64
  while (hash * 2 <= memoryMb / 8 && hash < 4096) hash *= 2
  return { threads: Math.min(16, Math.max(1, cpus - 1)), hash }
})

async function applyRecommended() {
  const wanted: [string, number][] = [['Threads', recommended.value.threads], ['Hash', recommended.value.hash]]
  for (const [name, value] of wanted) {
    if (engine.options.some((o) => o.name === name)) await engine.setOption(name, String(value))
  }
}
</script>