<template>
  <div class="space-y-2">
    <div class="h-2 rounded overflow-hidden border border-neutral-300" style="background: #262626"
      role="img" :aria-label="`Valutazione: ${formatScore(engine.lines[0]?.score ?? null)}`">
      <div class="h-full transition-all duration-150" :style="{ width: whitePct + '%', background: '#f5f5f5' }"></div>
    </div>

    <p v-if="engine.positionNote" class="text-xs font-semibold text-neutral-700">{{ engine.positionNote }}</p>
    <p v-else-if="!rows.length" class="text-[11px] text-neutral-500">In attesa del motore…</p>

    <ol v-else class="space-y-1.5" :class="stale ? 'opacity-40' : ''">
      <li v-for="r in rows" :key="r.line.multipv" class="flex items-start gap-2 text-[12px] leading-snug">
        <span class="shrink-0 w-14 text-right font-mono font-bold text-neutral-900">{{ formatScore(r.line.score) }}</span>
        <span class="shrink-0 w-8 text-[10px] text-neutral-400 leading-[18px]" title="Profondità">d{{ r.line.depth }}</span>
        <span class="min-w-0 flex-1 break-words">{{ r.pv.text }}<span v-if="!r.pv.complete">…</span></span>
        <button type="button" :disabled="!canAdd || stale" :title="addTitle" @click="add(r)"
          class="shrink-0 w-6 h-5 rounded border border-neutral-300 text-[11px] font-bold hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition">+</button>
      </li>
    </ol>

    <div v-if="top" class="flex items-center justify-between gap-2 text-[10px] text-neutral-500">
      <span>Profondità {{ top.depth }}<template v-if="speed"> · {{ speed }}</template></span>
      <label class="flex items-center gap-1">Aggiungi
        <select v-model.number="plies" class="border border-neutral-200 rounded px-1 py-0.5 bg-white">
          <option :value="4">4 mezze mosse</option>
          <option :value="8">8 mezze mosse</option>
          <option :value="12">12 mezze mosse</option>
          <option :value="24">tutta la linea</option>
        </select>
      </label>
    </div>

    <button v-if="canSaveArrow" type="button" @click="saveArrow"
      class="w-full py-1 text-[11px] font-semibold border border-neutral-300 rounded hover:bg-neutral-100 transition"
      title="Salva la freccia della mossa migliore tra le frecce di questa posizione">Salva freccia nella posizione</button>

    <p v-if="!canAdd && addTitle && rows.length" class="text-[10px] text-neutral-500">{{ addTitle }}</p>
    <p v-if="feedback" class="text-[11px] text-blue-700" aria-live="polite">{{ feedback }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useEngineStore } from '../../../stores/engineStore'
import { useChessTreeStore } from '../../../stores/chessTreeStore'
import { useChessBookStore } from '../../../stores/chessBookStore'
import { formatScore, pvToSan, type PvResult } from '../../../utils/uciPv'
import { reorderBlockedReason } from '../../../utils/treeOps'
import { cleanShapes } from '../../../utils/shapes'
import type { AnalysisLine } from '@mtc/shared'

const engine = useEngineStore()
const treeStore = useChessTreeStore()
const bookStore = useChessBookStore()

const plies = ref(8)
const feedback = ref<string | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
const say = (text: string) => {
  feedback.value = text
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => { feedback.value = null }, 4000)
}
onBeforeUnmount(() => clearTimeout(feedbackTimer))

// Linee mostrate: si riferiscono alla posizione analizzata, che può non essere più quella attiva
const stale = computed(() => engine.analyzedFen !== treeStore.activeFen)
const top = computed(() => engine.lines[0] ?? null)

const rows = computed<{ line: AnalysisLine; pv: PvResult }[]>(() => {
  const fen = engine.analyzedFen
  if (!fen) return []
  return engine.lines.map((line) => ({ line, pv: pvToSan(fen, line.pv, 24) }))
})

const whitePct = computed(() => {
  const s = top.value?.score
  if (!s) return 50
  if (s.kind === 'mate') return s.value > 0 ? 100 : s.value < 0 ? 0 : 50
  return 100 / (1 + Math.exp(-s.value / 400))
})

const speed = computed(() => {
  const nps = top.value?.nps
  if (!nps) return ''
  return nps >= 1e6 ? `${(nps / 1e6).toFixed(1)} Mnodi/s` : `${Math.round(nps / 1e3)} knodi/s`
})

// Perché non si può aggiungere (null = si può)
const addBlocker = computed<string | null>(() => {
  const tree = treeStore.currentTree
  if (bookStore.isLocked) return 'Documento in sola lettura.'
  if (!tree) return 'Seleziona una mossa di un albero del documento per aggiungere la linea.'
  return reorderBlockedReason(tree, treeStore.trees)
})
const canAdd = computed(() => addBlocker.value === null)
const addTitle = computed(() => addBlocker.value ?? 'Aggiungi questa linea come variante nell\'albero')

function add(row: { pv: PvResult }) {
  const sans = row.pv.sans.slice(0, plies.value)
  const added = treeStore.addLine(sans)
  if (added === null) say('Impossibile aggiungere la linea.')
  else if (added === 0) say('La linea è già presente nell\'albero.')
  else say(`Aggiunte ${added} mosse all'albero.`)
}

const canSaveArrow = computed(() =>
  !stale.value && !!top.value?.pv[0] && !!treeStore.currentNode && !!treeStore.currentTree && !bookStore.isLocked)

function saveArrow() {
  const node = treeStore.currentNode
  const uci = top.value?.pv[0]
  if (!node || !uci) return
  treeStore.setNodeShapes(cleanShapes([...(node.shapes ?? []), { orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush: 'green' }]))
  say('Freccia salvata nella posizione.')
}
</script>