<template>
  <div class="space-y-3">
    <p v-if="!canUse" class="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
      Apri un capitolo per importare un PGN: i blocchi partita stanno nei capitoli.
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

      <!-- 2. Cosa verrà importato -->
      <div v-if="game" class="space-y-1.5">
        <span class="text-[11px] font-medium text-neutral-500">2. Cosa verrà importato</span>
        <select v-if="parsed.games.length > 1" v-model.number="gameIndex"
          class="w-full text-xs border border-neutral-200 rounded px-2 py-1">
          <option v-for="g in parsed.games" :key="g.index" :value="g.index">
            {{ g.index + 1 }}. {{ g.title }}{{ g.result ? ' (' + g.result + ')' : '' }}
          </option>
        </select>

        <div class="rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] text-neutral-700">
          <div class="font-semibold">{{ game.title }}</div>
          <div v-if="game.problem" class="text-red-600">{{ game.problem }}</div>
          <div v-else-if="preview" class="text-neutral-500">
            {{ preview.stats.moves }} mosse · {{ preview.stats.variations }} varianti ·
            {{ preview.stats.comments }} commenti<span v-if="preview.stats.nags"> · {{ preview.stats.nags }} simboli</span>
          </div>
          <ul v-if="preview && preview.stats.warnings.length" class="mt-1 text-amber-700 list-disc pl-4 space-y-0.5">
            <li v-for="w in preview.stats.warnings.slice(0, 3)" :key="w">{{ w }}</li>
            <li v-if="preview.stats.warnings.length > 3">… e altri {{ preview.stats.warnings.length - 3 }} avvisi</li>
          </ul>
        </div>
      </div>

      <!-- 3. Destinazione -->
      <div v-if="game && !game.problem" class="space-y-2">
        <span class="text-[11px] font-medium text-neutral-500">3. Dove va agganciato</span>

        <label class="block rounded border px-2 py-1.5 cursor-pointer"
          :class="pgn.mode === 'new-block' ? 'border-neutral-900 bg-white' : 'border-neutral-200'">
          <div class="flex items-center gap-2 text-xs font-semibold">
            <input type="radio" value="new-block" v-model="pgn.mode" /> Nuovo blocco partita
          </div>
          <div v-if="pgn.mode === 'new-block'" class="mt-1.5 space-y-1">
            <select v-model="pgn.placement" class="w-full text-xs border border-neutral-200 rounded px-2 py-1">
              <option value="after-active" :disabled="!afterActiveAvailable">Dopo il blocco attivo</option>
              <option value="cursor">Dopo il punto in cui si trova il cursore</option>
              <option value="end">In fondo al capitolo</option>
            </select>
            <p class="text-[11px] text-blue-700">
              Verrà creato un nuovo blocco {{ placementLabel }}. Il punto è segnato nel documento.
            </p>
          </div>
        </label>

        <label class="block rounded border px-2 py-1.5"
          :class="[pgn.mode === 'append-active' ? 'border-neutral-900 bg-white' : 'border-neutral-200',
                   appendReason ? 'opacity-60' : 'cursor-pointer']">
          <div class="flex items-center gap-2 text-xs font-semibold">
            <input type="radio" value="append-active" v-model="pgn.mode" :disabled="!!appendReason" />
            Aggiungi al blocco attivo
          </div>
          <p class="mt-1 text-[11px]" :class="appendReason ? 'text-neutral-500' : 'text-blue-700'">
            {{ appendReason || appendText }}
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
import {
  parsePgnText, buildTreeFromGame, samePosition, nodeLabel, type PgnGameInfo
} from '../../utils/pgnImport'

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
const parsed = ref<{ games: PgnGameInfo[]; error?: string }>({ games: [] })
const gameIndex = ref(0)
const result = ref<{ ok: boolean; message: string } | null>(null)

let timer: number | undefined
watch(text, (value) => {
  fileError.value = ''
  result.value = null
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    parsed.value = value.trim() ? parsePgnText(value) : { games: [] }
    gameIndex.value = 0
  }, 300)
})
watch(gameIndex, () => { result.value = null })

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

const game = computed(() => parsed.value.games[gameIndex.value] ?? null)
const preview = computed(() => (game.value && !game.value.problem ? buildTreeFromGame(game.value) : null))

// --- Destinazione: nuovo blocco ---
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

// --- Destinazione: blocco attivo ---
const appendReason = computed<string | null>(() => {
  const tree = treeStore.currentTree
  if (!tree) return 'Nessun blocco partita attivo: cliccane uno nel documento.'
  if (!game.value) return null
  const targetFen = treeStore.currentNode?.fen ?? tree.startingFen
  return samePosition(game.value.startFen, targetFen)
    ? null
    : 'La posizione di partenza del PGN non coincide con quella della scacchiera.'
})
watch(appendReason, (reason) => {
  if (reason && pgn.mode === 'append-active') pgn.mode = 'new-block'
})

const appendText = computed(() => {
  const tree = treeStore.currentTree
  if (!tree) return ''
  const node = treeStore.currentNode
  const where = node ? `dopo la mossa ${nodeLabel(node)}` : 'all’inizio'
  return `Si aggancia ${where} del blocco «${tree.title}», evidenziato nel documento. Le mosse già presenti vengono unite.`
})

// --- Importazione ---
const canImport = computed(() =>
  !!game.value && !game.value.problem && (pgn.mode === 'new-block' || !appendReason.value)
)

const doImport = () => {
  if (game.value) result.value = pgn.runImport(game.value)
}
</script>