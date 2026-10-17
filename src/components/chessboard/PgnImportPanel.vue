<template>
  <div class="space-y-3">
    <p v-if="!canUse" class="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
      Apri un capitolo per importare un PGN: gli alberi di mosse stanno nei capitoli.
    </p>

    <template v-else>
      <!-- 1. Sorgente -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-neutral-500">1. Incolla il PGN o carica un file</span>
          <button class="text-[11px] font-semibold text-neutral-700 underline" @click="fileInput?.click()">
            Carica file…
          </button>
          <input ref="fileInput" type="file" accept=".pgn,.txt,text/plain" class="hidden" @change="onFile" />
        </div>
        <textarea v-model="text" rows="4" placeholder='1. e4 e5 2. Nf3 (2. f4 exf4) 2... Nc6 {commento}'
          class="w-full font-mono text-[11px] bg-neutral-50 border border-neutral-200 p-2 rounded focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none"></textarea>
        <p v-if="fileError || parsed.error" class="text-[11px] text-red-600">{{ fileError || parsed.error }}</p>
      </div>

      <!-- 2. Partite del file -->
      <div v-if="parsed.games.length" class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-neutral-500">
            2. Partite nel file ({{ selectedGames.length }}/{{ parsed.games.length }} selezionate)
          </span>
          <button v-if="parsed.games.length > 1" class="text-[11px] font-semibold text-neutral-700 underline"
            @click="toggleAll">
            {{ allSelected ? 'Deseleziona tutte' : 'Seleziona tutte' }}
          </button>
        </div>

        <ul class="max-h-48 overflow-y-auto rounded border border-neutral-200 bg-neutral-50 divide-y divide-neutral-200">
          <li v-for="g in parsed.games" :key="g.index" class="px-2 py-1.5 text-[11px]">
            <label class="flex items-start gap-2" :class="g.problem ? 'opacity-70' : 'cursor-pointer'">
              <input type="checkbox" class="mt-0.5" :value="g.index" v-model="selectedIdx" :disabled="!!g.problem" />
              <div class="min-w-0">
                <div class="font-semibold text-neutral-700 truncate">
                  {{ g.title }}<span v-if="g.result" class="font-normal text-neutral-500"> ({{ g.result }})</span>
                </div>
                <div v-if="g.problem" class="text-red-600">{{ g.problem }}</div>
                <div v-else-if="previews.get(g.index)" class="text-neutral-500">
                  {{ previews.get(g.index)!.moves }} mosse · {{ previews.get(g.index)!.variations }} varianti ·
                  {{ previews.get(g.index)!.comments }} commenti
                </div>
              </div>
            </label>
          </li>
        </ul>

        <p v-if="parsed.empty" class="text-[11px] text-amber-700">
          {{ parsed.empty }} {{ parsed.empty === 1 ? 'partita senza mosse ignorata' : 'partite senza mosse ignorate' }}.
        </p>
        <ul v-if="singlePreview && singlePreview.warnings.length"
          class="text-[11px] text-amber-700 list-disc pl-4 space-y-0.5">
          <li v-for="w in singlePreview.warnings.slice(0, 3)" :key="w">{{ w }}</li>
          <li v-if="singlePreview.warnings.length > 3">… e altri {{ singlePreview.warnings.length - 3 }} avvisi</li>
        </ul>
      </div>

      <!-- 3. Destinazione -->
      <div v-if="selectedGames.length" class="space-y-2">
        <span class="text-[11px] font-medium text-neutral-500">3. Dove va inserito</span>

        <label class="block rounded border px-2 py-1.5 cursor-pointer"
          :class="pgn.mode === 'new-tree' ? 'border-neutral-900 bg-white' : 'border-neutral-200'">
          <div class="flex items-center gap-2 text-xs font-semibold">
            <input type="radio" value="new-tree" v-model="pgn.mode" />
            {{ selectedGames.length > 1 ? 'Nuovi alberi di mosse (uno per partita)' : 'Nuovo albero di mosse' }}
          </div>
          <div v-if="pgn.mode === 'new-tree'" class="mt-1.5 space-y-1">
            <select v-model="pgn.placement" class="w-full text-xs border border-neutral-200 rounded px-2 py-1">
              <option value="after-active" :disabled="!afterActiveAvailable">Dopo l’albero attivo</option>
              <option value="cursor">Dopo il punto in cui si trova il cursore</option>
              <option value="end">In fondo al capitolo</option>
            </select>
            <p class="text-[11px] text-blue-700">
              {{ selectedGames.length > 1 ? `Verranno creati ${selectedGames.length} blocchi` : 'Verrà creato un nuovo blocco' }}
              {{ placementLabel }}. Il punto è segnato nel documento.
            </p>
          </div>
        </label>

        <label class="block rounded border px-2 py-1.5"
          :class="[pgn.mode === 'into-active' ? 'border-neutral-900 bg-white' : 'border-neutral-200',
                   intoActiveReason ? 'opacity-60' : 'cursor-pointer']">
          <div class="flex items-center gap-2 text-xs font-semibold">
            <input type="radio" value="into-active" v-model="pgn.mode" :disabled="!!intoActiveReason" />
            Aggiungi all’albero attivo
          </div>
          <p class="mt-1 text-[11px]" :class="intoActiveReason ? 'text-neutral-500' : 'text-blue-700'">
            {{ intoActiveReason || intoActiveText }}
          </p>
        </label>
      </div>

      <button @click="doImport" :disabled="!canImport"
        class="w-full py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white disabled:bg-neutral-200 disabled:text-neutral-400 font-medium rounded text-xs transition">
        Importa nel documento
      </button>
      <p v-if="result" class="text-[11px]" :class="result.ok ? 'text-green-700' : 'text-red-600'">
        {{ result.message }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useChessTreeStore } from '../../stores/chessTreeStore'
import { useChessBookStore } from '../../stores/chessBookStore'
import { usePgnImportStore } from '../../stores/pgnImportStore'
import { parsePgnText, buildTreeFromGame, nodeLabel, type PgnGameInfo, type ImportStats } from '../../utils/pgnImport'
import { samePosition } from '../../utils/fen'

const CONFIRM_THRESHOLD = 50   // oltre questo numero di alberi si chiede conferma
const PREVIEW_LIMIT = 30       // oltre questo numero di partite non si calcolano le statistiche per riga

const treeStore = useChessTreeStore()
const bookStore = useChessBookStore()
const pgn = usePgnImportStore()

const canUse = computed(() => bookStore.activeSectionInfo?.type === 'chapter')

// Il pannello aperto attiva i riferimenti nel documento (riquadro tratteggiato e cartellino)
watch(canUse, (v) => { pgn.isOpen = v }, { immediate: true })
onBeforeUnmount(() => { pgn.isOpen = false })

// --- Sorgente ---
const text = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const fileError = ref('')
const parsed = ref<{ games: PgnGameInfo[]; empty?: number; error?: string }>({ games: [] })
const selectedIdx = ref<number[]>([])
const result = ref<{ ok: boolean; message: string } | null>(null)

let timer: number | undefined
watch(text, (value) => {
  fileError.value = ''
  result.value = null
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    parsed.value = value.trim() ? parsePgnText(value) : { games: [] }
    selectedIdx.value = parsed.value.games.filter(g => !g.problem).map(g => g.index)
  }, 300)
})
watch(selectedIdx, () => { result.value = null })

const onFile = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      fileError.value = 'Il file è troppo grande (massimo 5 MB).'
    } else {
      text.value = await file.text()
    }
  }
  input.value = ''
}

// --- Selezione ---
const validGames = computed(() => parsed.value.games.filter(g => !g.problem))
const selectedGames = computed(() =>
  parsed.value.games.filter(g => !g.problem && selectedIdx.value.includes(g.index))
)
const allSelected = computed(() => validGames.value.length > 0 && selectedGames.value.length === validGames.value.length)
const toggleAll = () => {
  selectedIdx.value = allSelected.value ? [] : validGames.value.map(g => g.index)
}

const previews = computed(() => {
  const map = new Map<number, ImportStats>()
  if (parsed.value.games.length > PREVIEW_LIMIT) return map
  for (const g of validGames.value) map.set(g.index, buildTreeFromGame(g).stats)
  return map
})
const singlePreview = computed<ImportStats | null>(() => {
  if (selectedGames.value.length !== 1) return null
  const g = selectedGames.value[0]
  return previews.value.get(g.index) ?? buildTreeFromGame(g).stats
})

// --- Destinazione: nuovo albero ---
const afterActiveAvailable = computed(() => {
  pgn.selectionTick; treeStore.activeTreeId
  return pgn.canPlace('after-active')
})
watch(afterActiveAvailable, (available) => {
  if (!available && pgn.placement === 'after-active') pgn.placement = 'cursor'
  if (available && pgn.placement === 'cursor' && !pgn.isOpen) pgn.placement = 'after-active'
}, { immediate: true })

const placementLabel = computed(() => {
  pgn.selectionTick; treeStore.activeTreeId
  return pgn.describePlacement(pgn.placement)
})

// --- Destinazione: albero attivo ---
const intoActiveReason = computed<string | null>(() => {
  const tree = treeStore.currentTree
  if (!tree) return 'Nessun albero attivo: cliccane uno nel documento.'
  if (selectedGames.value.length > 1) return 'Con più partite si creano solo nuovi alberi.'
  if (selectedGames.value.length === 0 || tree.rootNodes.length === 0) return null
  const targetFen = treeStore.currentNode?.fen ?? tree.startingFen
  return samePosition(selectedGames.value[0].startFen, targetFen)
    ? null
    : 'La posizione di partenza del PGN non coincide con quella della mossa selezionata.'
})
watch(intoActiveReason, (reason) => {
  if (reason && pgn.mode === 'into-active') pgn.mode = 'new-tree'
})

const intoActiveText = computed(() => {
  const tree = treeStore.currentTree
  if (!tree) return ''
  if (tree.rootNodes.length === 0) {
    return `Il PGN diventa il contenuto dell’albero «${tree.title}» e ne fissa la posizione iniziale.`
  }
  const node = treeStore.currentNode
  const where = node ? `dopo la mossa ${nodeLabel(node)}` : 'all’inizio'
  return `Si aggancia ${where} dell’albero «${tree.title}», evidenziato nel documento. Le mosse già presenti vengono unite.`
})

// --- Importazione ---
const canImport = computed(() =>
  selectedGames.value.length > 0 && (pgn.mode === 'new-tree' || !intoActiveReason.value)
)

const doImport = () => {
  if (!canImport.value) return
  const n = selectedGames.value.length
  if (pgn.mode === 'new-tree' && n > CONFIRM_THRESHOLD &&
    !confirm(`Stai per creare ${n} alberi di mosse nel capitolo: l’editor potrebbe rallentare. Continuare?`)) return
  result.value = pgn.runImport(selectedGames.value, parsed.value.empty ?? 0)
}
</script>
