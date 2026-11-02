<template>
  <div class="space-y-3">
    <EngineProfiles v-if="!engine.profiles.length" />

    <template v-else>
      <div class="flex items-center gap-2">
        <button type="button" role="switch" :aria-checked="engine.isRunning" :disabled="starting || !engine.activeProfile"
          :title="engine.isRunning ? 'Spegni il motore' : 'Avvia il motore'" @click="toggle"
          class="relative inline-block w-9 h-5 rounded-full shrink-0 transition-colors disabled:opacity-40 cursor-pointer"
          :class="engine.isRunning ? 'bg-blue-600' : 'bg-neutral-300'">
          <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
            :class="engine.isRunning ? 'translate-x-4' : ''"></span>
        </button>
        <div class="min-w-0 flex-1" aria-live="polite">
          <div class="text-xs font-bold text-neutral-800 truncate">{{ title }}</div>
          <div class="text-[11px]" :class="engine.state.error ? 'text-red-600 font-medium' : 'text-neutral-500'">{{ statusLabel }}</div>
        </div>
      </div>

      <p v-if="engine.activeProfile && !engine.isRunning" class="text-[10px] font-mono text-neutral-500 break-all">
        {{ engine.activeProfile.path }}<template v-if="engine.activeProfile.args.length"> {{ formatArgs(engine.activeProfile.args) }}</template>
      </p>
    </template>

    <p v-if="engine.state.error" class="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
      {{ engine.state.error.message }}
    </p>
    <p v-else-if="engine.lastError" class="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
      {{ engine.lastError }}
    </p>

    <template v-if="engine.profiles.length">
      <EngineAnalysis v-if="engine.isRunning" />
      <EngineSettings v-if="engine.isRunning" />
      <p v-else-if="!starting" class="text-[11px] text-neutral-500">
        Avvia il motore per vedere l'analisi e modificarne le impostazioni.
      </p>

      <details class="rounded border border-neutral-200">
        <summary class="px-2 py-1.5 text-[11px] font-semibold text-neutral-700 cursor-pointer select-none">Motori configurati</summary>
        <div class="p-2"><EngineProfiles /></div>
      </details>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useEngineStore } from '../../stores/engineStore'
import { useChessTreeStore } from '../../stores/chessTreeStore'
import { useChessBookStore } from '../../stores/chessBookStore'
import { formatArgs } from '../../utils/engineArgs'
import EngineProfiles from './engine/EngineProfiles.vue'
import EngineAnalysis from './engine/EngineAnalysis.vue'
import EngineSettings from './engine/EngineSettings.vue'

const engine = useEngineStore()
const treeStore = useChessTreeStore()
const bookStore = useChessBookStore()

const starting = computed(() => engine.state.status === 'starting')
const title = computed(() => engine.state.engineName ?? engine.activeProfile?.name ?? 'Motore')

const LABELS = {
  'not-configured': 'Nessun motore configurato',
  stopped: 'Spento',
  starting: 'Avvio in corso…',
  ready: 'Pronto',
  analyzing: 'In analisi',
  error: 'Errore',
  crashed: 'Interrotto',
} as const
const statusLabel = computed(() => LABELS[engine.state.status])

const toggle = () => void (engine.isRunning ? engine.disable() : engine.enable())

// --- Sincronizzazione con la posizione attiva ---
let timer: ReturnType<typeof setTimeout> | undefined
let newGame = true // ucinewgame solo quando cambia albero o capitolo, non a ogni mossa

function schedule() {
  clearTimeout(timer)
  // La navigazione rapida con le frecce non accoda ricerche inutili
  timer = setTimeout(() => {
    engine.analyzePosition(treeStore.activeFen, newGame)
    newGame = false
  }, 120)
}

watch(() => treeStore.activeFen, schedule)
watch([() => treeStore.activeTreeId, () => bookStore.activeSectionId], () => { newGame = true })

// --- Freccia della mossa migliore sulla scacchiera (temporanea, mai salvata) ---
const arrow = computed(() => {
  const best = engine.lines[0]?.pv[0]
  if (!best || !engine.isRunning || !engine.prefs.showArrow || engine.analyzedFen !== treeStore.activeFen) return []
  return [{ orig: best.slice(0, 2), dest: best.slice(2, 4), brush: 'paleBlue' }]
})
watch(arrow, (shapes) => treeStore.setAutoShapes(shapes), { deep: true, immediate: true })

// --- Finestra non visibile: il motore non lavora a vuoto ---
const onVisibility = () => {
  if (document.visibilityState === 'hidden') engine.stopAnalysis()
  else schedule()
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibility)
  await engine.init()
  engine.analyzePosition(treeStore.activeFen, true)
})

onBeforeUnmount(() => {
  clearTimeout(timer)
  document.removeEventListener('visibilitychange', onVisibility)
  treeStore.setAutoShapes([])
  engine.stopAnalysis()
  engine.dispose()
})
</script>