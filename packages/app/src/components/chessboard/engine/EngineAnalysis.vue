<template>
  <div class="space-y-1.5">
    <ol class="space-y-1" :class="stale ? 'opacity-40' : ''">
      <li v-for="slot in slots" :key="slot.n" class="flex items-start gap-2 h-9">
        <span class="shrink-0 w-16 pt-px" :title="slot.row ? `Profondità ${slot.row.line.depth}` : undefined">
          <span v-if="slot.row" class="inline-block px-1.5 rounded font-mono font-bold leading-[22px]"
            :class="scoreClass(slot.n)">{{ formatScore(slot.row.line.score) }}</span>
        </span>
        <span class="min-w-0 flex-1 pt-0.5 text-[12px] leading-4 line-clamp-2 break-words" :title="slot.row?.pv.text">
          {{ slot.row?.pv.text }}<span v-if="slot.row && !slot.row.pv.complete">…</span>
        </span>
        <button type="button" :disabled="!slot.row || !canAdd || stale" :title="addTitle" @click="slot.row && add(slot.row)"
          class="shrink-0 w-6 h-5 mt-0.5 rounded border border-neutral-300 text-[11px] font-bold hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition">+</button>
      </li>
    </ol>

    <div class="flex items-center justify-between gap-2 h-6 text-[10px] text-neutral-500">
      <span class="truncate" :class="engine.positionNote ? 'text-xs font-semibold text-neutral-700' : ''">{{ infoText }}</span>
      <label class="flex items-center gap-1 shrink-0">Aggiungi
        <select v-model.number="plies" class="border border-neutral-200 rounded px-1 py-0.5 bg-white">
          <option :value="4">4 mezze mosse</option>
          <option :value="8">8 mezze mosse</option>
          <option :value="12">12 mezze mosse</option>
          <option :value="24">tutta la linea</option>
        </select>
      </label>
    </div>

    <button type="button" :disabled="!canSaveArrow" @click="saveArrow"
      class="w-full py-1 text-[11px] font-semibold border border-neutral-300 rounded hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
      title="Salva la freccia della mossa migliore tra le frecce di questa posizione">Salva freccia nella posizione</button>

    <p class="h-4 text-[11px] truncate" :class="feedback ? 'text-blue-700' : 'text-neutral-500'"
      :title="hint" aria-live="polite">{{ hint }}</p>
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

const MAX_ROWS = 10   // righe riservate al massimo
const EVEN_CP = 15    // entro questo valore (centesimi di pedone) la posizione è «pari»

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

// Le linee si riferiscono alla posizione analizzata, che può non essere più quella attiva
const stale = computed(() => engine.analyzedFen !== treeStore.activeFen)
const top = computed(() => engine.lines[0] ?? null)

const rows = computed<{ line: AnalysisLine; pv: PvResult }[]>(() => {
  const fen = engine.analyzedFen
  if (!fen) return []
  return engine.lines.map((line) => ({ line, pv: pvToSan(fen, line.pv, 24) }))
})

// Righe sempre presenti, tante quante le linee richieste: il pannello non cambia altezza durante l'analisi
const lineCount = computed(() => {
  const v = Number(engine.options.find((o) => o.name.toLowerCase() === 'multipv')?.value)
  return Number.isFinite(v) ? Math.min(MAX_ROWS, Math.max(1, Math.round(v))) : 1
})
const slots = computed(() =>
  Array.from({ length: lineCount.value }, (_, i) => ({ n: i + 1, row: rows.value.find((r) => r.line.multipv === i + 1) ?? null })))

// Vantaggio visto dal lato che sta in basso sulla scacchiera (la valutazione del motore è sempre dal punto di vista del Bianco)
const tone = computed<'good' | 'bad' | 'even' | null>(() => {
  const s = top.value?.score
  if (!s) return null
  const mine = treeStore.boardFlipped ? -1 : 1
  const advantage = s.kind === 'mate' ? Math.sign(s.value) * mine * 100000 : s.value * mine
  if (Math.abs(advantage) <= EVEN_CP) return 'even'
  return advantage > 0 ? 'good' : 'bad'
})

const TONES = {
  good: 'bg-green-50 text-green-700 border border-green-300',
  bad: 'bg-red-50 text-red-700 border border-red-300',
  even: 'bg-neutral-100 text-neutral-800 border border-neutral-300',
} as const

const scoreClass = (n: number) =>
  n === 1 ? ['text-[13px]', TONES[tone.value ?? 'even']] : ['text-[12px]', 'text-neutral-600', 'border border-transparent']

const speed = computed(() => {
  const nps = top.value?.nps
  if (!nps) return ''
  return nps >= 1e6 ? `${(nps / 1e6).toFixed(1)} Mnodi/s` : `${Math.round(nps / 1e3)} knodi/s`
})

const infoText = computed(() => {
  if (engine.positionNote) return engine.positionNote
  const t = top.value
  if (!t) return 'In attesa del motore…'
  return `Profondità ${t.depth}${speed.value ? ' · ' + speed.value : ''}`
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

const hint = computed(() => feedback.value ?? (rows.value.length && !canAdd.value ? addBlocker.value ?? '' : ''))

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