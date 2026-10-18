<template>
  <div class="w-[400px] bg-white border border-neutral-200 rounded-lg p-4 shadow-sm space-y-4">

    <!-- Stato: libera o albero -->
    <div class="rounded-md border px-3 py-2 flex items-start justify-between gap-2"
      :class="tree ? 'border-blue-300 bg-blue-50' : 'border-neutral-200 bg-neutral-50'">
      <div class="min-w-0">
        <div class="text-xs font-bold truncate" :class="tree ? 'text-blue-800' : 'text-neutral-600'">
          {{ tree ? `Albero: ${tree.title}` : 'Posizione libera' }}
        </div>
        <div class="text-[11px]" :class="tree ? 'text-blue-700' : 'text-neutral-500'">{{ statusSubtitle }}</div>
        <label v-if="tree && hasHeader"
          class="mt-1.5 flex items-center gap-1.5 text-[11px] text-blue-800 cursor-pointer select-none">
          <input type="checkbox" :checked="!!tree.showHeader" @change="onToggleHeader" />
          Mostra intestazione nel documento
        </label>
      </div>
      <button v-if="tree" @click="treeStore.deactivateTree()"
        class="shrink-0 text-[11px] font-semibold text-blue-800 underline underline-offset-2 hover:text-blue-950"
        title="Scollega dall'albero: la posizione resta sulla scacchiera e le mosse non vengono più registrate">
        Scollega
      </button>
    </div>

    <div class="flex items-center justify-between border-b border-neutral-100 pb-2">
      <span class="text-xs font-bold text-neutral-400 uppercase tracking-wider">Console Scacchiera</span>
      <div class="flex items-center gap-3">
        <button @click="emit('clearShapes')"
          class="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition underline underline-offset-4"
          title="Frecce e cerchi: tasto destro sulla scacchiera (nero nel libro); con Maiusc o Ctrl (grigio nel libro)">
          Cancella frecce
        </button>
        <button v-if="showReset" @click="emit('reset')"
          class="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition underline underline-offset-4">
          Resetta Posizione
        </button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 items-center">
      <span class="text-xs font-medium text-neutral-500">Ultima mossa:</span>
      <span
        class="col-span-2 justify-self-start font-mono bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-xs text-neutral-800 font-bold">
        {{ lastMove }}
      </span>
    </div>

    <!-- Simboli di valutazione della mossa attiva -->
    <div v-if="showNags" class="space-y-1.5">
      <div v-for="g in NAG_GROUPS" :key="g.id">
        <div class="text-[10px] font-medium text-neutral-400 mb-0.5">{{ g.title }}</div>
        <div class="flex flex-wrap gap-1">
          <button v-for="n in g.items" :key="n.code" @click="toggleNag(n.code)" :title="n.label"
            :aria-pressed="activeNags.includes(n.code)"
            class="min-w-[32px] h-7 px-1.5 rounded border text-xs font-bold transition"
            :class="activeNags.includes(n.code)
              ? 'bg-neutral-900 border-neutral-900 text-white'
              : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100'">
            {{ n.symbol }}
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-3">
      <div class="flex border-b border-neutral-200 text-xs font-semibold">
        <button @click="activeTab = 'fen'"
          :class="activeTab === 'fen' ? 'border-b-2 border-black text-black' : 'text-neutral-400 hover:text-neutral-600'"
          class="pb-1.5 px-2 transition">FEN</button>
        <button @click="activeTab = 'pgn'"
          :class="activeTab === 'pgn' ? 'border-b-2 border-black text-black' : 'text-neutral-400 hover:text-neutral-600'"
          class="pb-1.5 px-2 transition">Importa PGN</button>
      </div>

      <div v-if="activeTab === 'fen'" class="space-y-1">
        <div class="flex justify-between items-center">
          <span class="text-[11px] font-medium text-neutral-400">Notazione FEN corrente:</span>
          <button @click="copyFenToClipboard"
            class="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 transition flex items-center gap-1">
            {{ copied ? 'Copiato!' : 'Copia FEN' }}
          </button>
        </div>
        <input type="text" :value="currentFen" :readonly="fenReadonly" @change="handleFenChange"
          class="w-full font-mono text-[11px] bg-neutral-900 text-neutral-300 p-2 rounded break-all focus:outline-none focus:ring-1 focus:ring-neutral-500 select-all leading-relaxed border border-neutral-800"
          :class="{ 'opacity-70 cursor-default': fenReadonly }" />
        <p v-if="fenLocked" class="text-[11px] text-neutral-500">
          Posizione iniziale già fissata: per partire da un’altra posizione crea un nuovo albero.
        </p>
        <p v-else-if="tree && locked" class="text-[11px] text-neutral-500">
          Documento in sola lettura: la posizione iniziale non è modificabile.
        </p>
        <p v-else-if="tree" class="text-[11px] text-blue-700">
          Un FEN incollato diventa la posizione iniziale di questo albero.
        </p>
      </div>

      <PgnImportPanel v-if="activeTab === 'pgn'" />
    </div>

    <div class="flex flex-wrap gap-2 pt-2">
      <button @click="emit('insertDiagram')" :disabled="!inChapter || locked"
        class="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-xs tracking-wide transition uppercase font-bold shadow-sm border border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed">
        Inserisci Diagramma
      </button>

      <button v-if="tree && treeStore.activeNodeId && !locked" @click="emit('deleteBranch')"
        class="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs transition uppercase font-bold border border-red-200"
        title="Elimina la mossa selezionata e tutto ciò che la segue">
        Elimina Variante
      </button>

      <button v-if="!tree || fenLocked" @click="emit('newTree')" :disabled="!inChapter || locked"
        class="w-full py-2 bg-white hover:bg-neutral-50 text-neutral-700 rounded text-xs transition font-semibold border border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed">
        + Nuovo albero da questa posizione
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useChessTreeStore } from '../../stores/chessTreeStore'
import { useChessBookStore } from '../../stores/chessBookStore'
import PgnImportPanel from './PgnImportPanel.vue'
import { hasDisplayableHeader } from '../../utils/pgnHeader'
import { NAG_GROUPS } from '../../utils/nags'

const props = defineProps<{
  currentFen: string
  lastMove: string
}>()

const emit = defineEmits<{
  (e: 'reset'): void
  (e: 'insertDiagram'): void
  (e: 'deleteBranch'): void
  (e: 'updateFen', newFen: string): void
  (e: 'newTree'): void
  (e: 'clearShapes'): void
}>()

const treeStore = useChessTreeStore()
const bookStore = useChessBookStore()
const activeTab = ref<'fen' | 'pgn'>('fen')
const copied = ref(false)

const tree = computed(() => treeStore.currentTree)
const fenLocked = computed(() => treeStore.isFenLocked)
const showReset = computed(() => !tree.value || treeStore.isCurrentTreeEmpty)
// Diagrammi e alberi si inseriscono solo in un capitolo (copertina e indice non hanno testo)
const inChapter = computed(() => bookStore.activeSectionInfo?.type === 'chapter')
// Sola lettura: l'albero del documento non si modifica; la posizione libera e la navigazione restano attive
const locked = computed(() => bookStore.isLocked)
const fenReadonly = computed(() => fenLocked.value || (locked.value && !!tree.value))

// L'interruttore compare solo se l'albero ha tag PGN da mostrare
const hasHeader = computed(() => !!tree.value && hasDisplayableHeader(tree.value.header))
const onToggleHeader = (event: Event) => {
  if (tree.value) treeStore.setShowHeader(tree.value.id, (event.target as HTMLInputElement).checked)
}

// I simboli si assegnano alla mossa attiva di un albero del documento
const showNags = computed(() => !!tree.value && !!treeStore.currentNode && !locked.value)
const activeNags = computed(() => treeStore.currentNode?.nags ?? [])
const toggleNag = (code: number) => {
  const id = treeStore.activeNodeId
  if (id) treeStore.toggleNag(id, code)
}

const statusSubtitle = computed(() => {
  if (!tree.value) return 'Mosse temporanee, non salvate nel documento'
  const node = treeStore.currentNode
  return node
    ? `dopo ${node.moveNumber}${node.color === 'w' ? '.' : '...'} ${node.san}`
    : 'Posizione iniziale dell’albero'
})

const copyFenToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.currentFen)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (err) {
    console.error('Impossibile copiare il FEN:', err)
  }
}

// Il campo mostra sempre il valore dello store: se il FEN viene rifiutato, il testo digitato sparisce
const handleFenChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!fenReadonly.value && target.value.trim() !== '') emit('updateFen', target.value.trim())
  await nextTick()
  target.value = props.currentFen
}
</script>
