<template>
  <!-- Pannello Scacchiera: sale dal basso e copre gran parte dell'appunto. In alto resta una striscia del testo. -->
  <Transition name="sheet" appear>
    <div v-if="request" class="sheet-root" @click.self="emit('close')">
      <section class="sheet" role="dialog" aria-modal="true" aria-label="Scacchiera"
        :style="{ transform: dragY ? `translateY(${dragY}px)` : undefined }">
        <div class="sheet-handle" aria-hidden="true"
          @touchstart.passive="onDragStart" @touchmove.passive="onDragMove" @touchend="onDragEnd"><span></span></div>

        <header class="flex items-center gap-2 px-4 pb-2">
          <div v-if="request.kind === 'new'" class="flex flex-1 rounded-lg bg-neutral-100 p-1" role="tablist">
            <button v-for="t in TABS" :key="t.id" type="button" role="tab" :aria-selected="tab === t.id"
              class="flex-1 rounded-md py-1.5 text-sm font-semibold transition"
              :class="tab === t.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'"
              @click="switchTab(t.id)">{{ t.label }}</button>
          </div>
          <h2 v-else class="flex-1 text-base font-semibold text-neutral-900">
            {{ request.kind === 'diagram' ? 'Modifica diagramma' : 'Modifica linea' }}
          </h2>
          <button v-if="request.kind !== 'new'" type="button" @click="emit('remove')"
            class="px-2 py-1.5 text-sm font-semibold text-red-600 rounded-md active:bg-red-50">
            <i class="fa-solid fa-trash-can"></i> Elimina
          </button>
          <button type="button" aria-label="Chiudi" @click="emit('close')"
            class="w-9 h-9 flex items-center justify-center rounded-full text-neutral-500 active:bg-neutral-100">✕</button>
        </header>

        <div class="sheet-body">
          <!-- Scheda Diagramma: editor della posizione -->
          <div v-if="tab === 'diagram'" class="flex flex-col items-center gap-3">
            <ChessboardView :key="`b${diagramKey}`" ref="editBoardRef" :fen="diagramFen" turn-color="white" :dests="NO_DESTS"
              :orientation="flipped ? 'black' : 'white'" :editable="boardReady" :tool="tool" :size="boardSize"
              @board-change="placement = $event" />
            <BoardEditorPanel :key="`p${diagramKey}`" ref="panelRef" :start-fen="diagramFen" :placement="placement" :tool="tool" :has-tree="false"
              :apply-label="request.kind === 'diagram' ? 'Aggiorna diagramma' : 'Inserisci diagramma'"
              valid-hint="Posizione valida." class="!shadow-none !border-0 !p-0"
              @update:tool="tool = $event" @set-placement="editBoardRef?.setPlacement($event)"
              @drag-piece="(piece, event) => editBoardRef?.dragNewPiece(piece, event)"
              @flip="flipped = !flipped" @apply="(fen) => emit('diagram', fen, flipped)" @cancel="emit('close')" />
          </div>

          <!-- Scheda Mosse: una linea giocata sulla scacchiera, con eventuali varianti -->
          <div v-else class="flex flex-col items-center gap-3">
            <div class="relative">
              <ChessboardView ref="playBoardRef" :fen="currentFen" :turn-color="turnColor" :dests="dests"
                :orientation="flipped ? 'black' : 'white'" :size="boardSize" @move="onMove" />
              <PromotionPicker v-if="pendingPromotion" :color="turnColor" @choose="completePromotion"
                @cancel="cancelPromotion" />
            </div>

            <div class="w-full max-w-[420px] flex gap-1">
              <button type="button" class="nav-btn" aria-label="Inizio" :disabled="!currentId" @click="currentId = null">
                <i class="fa-solid fa-backward-fast"></i></button>
              <button type="button" class="nav-btn" aria-label="Indietro" :disabled="!currentId" @click="goBack">
                <i class="fa-solid fa-chevron-left"></i></button>
              <button type="button" class="nav-btn" aria-label="Avanti" :disabled="!nextNodes.length" @click="goForward">
                <i class="fa-solid fa-chevron-right"></i></button>
              <button type="button" class="nav-btn" aria-label="Fine" :disabled="!nextNodes.length" @click="goEnd">
                <i class="fa-solid fa-forward-fast"></i></button>
              <button type="button" class="nav-btn" @click="flipped = !flipped">Inverti</button>
            </div>

            <div class="w-full max-w-[420px] min-h-[3rem] max-h-40 overflow-y-auto rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-900 line-text">
              <template v-if="tokens.length">
                <template v-for="(t, i) in tokens" :key="i">
                  <button v-if="t.kind === 'move'" type="button" class="line-move"
                    :class="[t.depth ? 'is-variation' : 'is-main', { 'is-current': t.id === currentId }]"
                    @click="currentId = t.id" v-html="moveHtml(t.text)"></button>
                  <span v-else class="line-paren" :class="t.depth > 0 && 'is-variation'">{{ t.kind === 'open' ? '(' : ')' }}</span>
                </template>
              </template>
              <span v-else class="text-neutral-500">Muovi i pezzi per registrare la linea.</span>
            </div>

            <div class="w-full max-w-[420px] flex gap-2">
              <button type="button" :disabled="!currentId" @click="deleteCurrent"
                class="flex-1 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-neutral-700 disabled:opacity-40">
                Elimina mossa
              </button>
              <button type="button" :disabled="!canPromote" @click="promoteCurrent"
                class="flex-1 py-2.5 rounded-lg border border-neutral-300 text-sm font-semibold text-neutral-700 disabled:opacity-40">
                Rendi principale
              </button>
            </div>
            <button type="button" :disabled="rootNodes.length === 0" @click="emit('line', lineStart, plainNodes())"
              class="w-full max-w-[420px] py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-semibold disabled:bg-neutral-200 disabled:text-neutral-400">
              {{ request.kind === 'line' ? 'Aggiorna linea' : 'Inserisci linea' }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chess } from 'chess.js'
import type { Key } from 'chessground/types'
import ChessboardView from '../components/chessboard/ChessboardView.vue'
import BoardEditorPanel from '../components/chessboard/BoardEditorPanel.vue'
import PromotionPicker from '../components/chessboard/PromotionPicker.vue'
import type { EditorTool } from '../utils/boardEditor'
import { STANDARD_FEN, isLegalFen, normalizeFen } from '../utils/fen'
import { escapeHtml } from '../utils/html'
import { figurinizeHtml } from '../utils/figurines'
import { addMove, lineTokens, removeMove } from './notesModel'
import type { ChessMoveNode } from '../stores/chessTreeStore'
import { findNode, makeMainLine, promoteTarget } from '../utils/treeOps'

export type SheetRequest =
  | { kind: 'new'; flipped: boolean }
  | { kind: 'diagram'; fen: string; flipped: boolean }
  | { kind: 'line'; startFen: string; rootNodes: ChessMoveNode[]; flipped: boolean }

type Tab = 'diagram' | 'moves'
type PromotionPiece = 'q' | 'r' | 'b' | 'n'

const props = defineProps<{ request: SheetRequest | null }>()
const emit = defineEmits<{
  (e: 'diagram', fen: string, flipped: boolean): void
  (e: 'line', startFen: string, rootNodes: ChessMoveNode[]): void
  (e: 'remove'): void
  (e: 'close'): void
}>()

const TABS: { id: Tab; label: string }[] = [
  { id: 'diagram', label: 'Diagramma' },
  { id: 'moves', label: 'Mosse' },
]
const NO_DESTS = new Map<Key, Key[]>()

const tab = ref<Tab>('diagram')
const flipped = ref(false)

// --- Misura della scacchiera: tutta la larghezza, senza superare metà altezza ---
const viewport = ref({ w: window.innerWidth, h: window.innerHeight })
const onResize = () => { viewport.value = { w: window.innerWidth, h: window.innerHeight } }
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
const boardSize = computed(() => Math.floor(Math.min(viewport.value.w - 40, 420, viewport.value.h * 0.48)))

// --- Scheda Diagramma ---
const editBoardRef = ref<InstanceType<typeof ChessboardView> | null>(null)
const panelRef = ref<InstanceType<typeof BoardEditorPanel> | null>(null)
const diagramFen = ref(STANDARD_FEN)
const placement = ref(STANDARD_FEN.split(' ')[0])
const tool = ref<EditorTool>(null)
// La scacchiera entra in modalità modifica solo dopo il montaggio (lo fa il watcher di ChessboardView)
const boardReady = ref(false)
const diagramKey = ref(0)   // nuova posizione di partenza: scacchiera e pannello ripartono da zero

const startDiagram = (fen: string) => {
  diagramFen.value = fen
  diagramKey.value++
  placement.value = fen.split(' ')[0]
  tool.value = null
  boardReady.value = false
  void nextTick(() => { boardReady.value = true })
}

// --- Scheda Mosse ---
// La linea è un albero: una mossa diversa da quella già giocata in quel punto apre una variante
const playBoardRef = ref<InstanceType<typeof ChessboardView> | null>(null)
const lineStart = ref(STANDARD_FEN)
const rootNodes = ref<ChessMoveNode[]>([])
const currentId = ref<string | null>(null)   // null = posizione di partenza
const pendingPromotion = ref<{ orig: Key; dest: Key } | null>(null)

const currentNode = computed(() => (currentId.value ? findNode(rootNodes.value, currentId.value) : null))
const currentFen = computed(() => currentNode.value?.fen ?? lineStart.value)
const nextNodes = computed(() => (currentNode.value ? currentNode.value.children : rootNodes.value))
const turnColor = computed<'white' | 'black'>(() => (currentFen.value.split(' ')[1] === 'b' ? 'black' : 'white'))
const dests = computed(() => {
  const map = new Map<Key, Key[]>()
  for (const m of new Chess(currentFen.value).moves({ verbose: true })) {
    if (!map.has(m.from as Key)) map.set(m.from as Key, [])
    map.get(m.from as Key)!.push(m.to as Key)
  }
  return map
})
const tokens = computed(() => lineTokens(rootNodes.value))
const moveHtml = (text: string) => figurinizeHtml(escapeHtml(text))
const canPromote = computed(() => !!currentId.value && !!promoteTarget(rootNodes.value, currentId.value))

const startLine = (fen: string, nodes: ChessMoveNode[] = []) => {
  lineStart.value = isLegalFen(fen) ? normalizeFen(fen) : STANDARD_FEN
  rootNodes.value = JSON.parse(JSON.stringify(nodes)) as ChessMoveNode[]
  // Riaprendo una linea si parte dalla fine della linea principale
  let last: ChessMoveNode | null = null
  for (let n = rootNodes.value; n.length; n = n[0].children) last = n[0]
  currentId.value = last?.id ?? null
  pendingPromotion.value = null
}
const plainNodes = () => JSON.parse(JSON.stringify(rootNodes.value)) as ChessMoveNode[]

const goBack = () => { currentId.value = currentNode.value?.parentId ?? null }
const goForward = () => { if (nextNodes.value.length) currentId.value = nextNodes.value[0].id }
const goEnd = () => { while (nextNodes.value.length) goForward() }

function play(orig: Key, dest: Key, promotion?: PromotionPiece) {
  let san: string
  try {
    san = new Chess(currentFen.value).move({ from: orig, to: dest, promotion }).san
  } catch {
    playBoardRef.value?.resync()
    return
  }
  const node = addMove(rootNodes.value, lineStart.value, currentId.value, san)
  if (node) currentId.value = node.id
  else playBoardRef.value?.resync()
}

const onMove = (orig: Key, dest: Key) => {
  const isPromotion = new Chess(currentFen.value).moves({ verbose: true })
    .some(m => m.from === orig && m.to === dest && !!m.promotion)
  if (isPromotion) pendingPromotion.value = { orig, dest }
  else play(orig, dest)
}
const completePromotion = (piece: PromotionPiece) => {
  const p = pendingPromotion.value
  pendingPromotion.value = null
  if (p) play(p.orig, p.dest, piece)
}
const cancelPromotion = () => {
  pendingPromotion.value = null
  playBoardRef.value?.resync()
}
/** Toglie la mossa corrente con il suo seguito */
const deleteCurrent = () => {
  if (currentId.value) currentId.value = removeMove(rootNodes.value, currentId.value)
}
/** La variante della mossa corrente diventa la linea principale */
const promoteCurrent = () => {
  if (currentId.value) makeMainLine(rootNodes.value, currentId.value)
}

// Passando a «Mosse» la linea parte dalla posizione composta nel Diagramma (se valida);
// tornando a «Diagramma» la posizione resta quella composta
function switchTab(next: Tab) {
  if (next === tab.value) return
  if (next === 'moves') {
    const fen = panelRef.value && !panelRef.value.error ? panelRef.value.fen : diagramFen.value
    diagramFen.value = fen
    if (normalizeFen(fen) !== lineStart.value) startLine(fen)
  } else {
    startDiagram(diagramFen.value)
  }
  tab.value = next
}

// --- Apertura ---
watch(() => props.request, (req) => {
  if (!req) return
  flipped.value = req.flipped
  if (req.kind === 'line') {
    tab.value = 'moves'
    startLine(req.startFen, req.rootNodes)
  } else {
    tab.value = 'diagram'
    startDiagram(req.kind === 'diagram' ? req.fen : STANDARD_FEN)
    startLine(STANDARD_FEN)
  }
}, { immediate: true })

// --- Trascinando la maniglia verso il basso il pannello si chiude ---
const dragY = ref(0)
let dragFrom: number | null = null
const onDragStart = (e: TouchEvent) => { dragFrom = e.touches[0]?.clientY ?? null }
const onDragMove = (e: TouchEvent) => {
  if (dragFrom === null) return
  dragY.value = Math.max(0, (e.touches[0]?.clientY ?? dragFrom) - dragFrom)
}
const onDragEnd = () => {
  if (dragY.value > 100) emit('close')
  dragY.value = 0
  dragFrom = null
}
</script>

<style scoped>
.sheet-root {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgb(0 0 0 / 0.25);
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  height: 86dvh;
  background: #fff;
  border-radius: 1rem 1rem 0 0;
  box-shadow: 0 -8px 24px rgb(0 0 0 / 0.15);
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease-out;
}
.sheet-handle {
  display: flex;
  justify-content: center;
  padding: 0.6rem 0 0.5rem;
  touch-action: none;
}
.sheet-handle span {
  width: 2.5rem;
  height: 0.3rem;
  border-radius: 999px;
  background: #d4d4d4;
}
.sheet-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 1rem calc(1rem + env(safe-area-inset-bottom));   /* in alto: spazio per il bordo della scacchiera */
}
.nav-btn {
  flex: 1;
  padding: 0.6rem 0;
  border: 1px solid #d4d4d4;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #404040;
}
.nav-btn:disabled { opacity: 0.35; }
.line-move {
  margin-right: 0.3em;
  padding: 0 2px;
  border-radius: 3px;
  -webkit-tap-highlight-color: transparent;
}
.line-move.is-main { font-weight: 600; }
.line-move.is-variation, .line-paren.is-variation { color: #525252; font-weight: 400; }
.line-move.is-current { background: #171717; color: #fff; }
.line-paren { margin-right: 0.15em; }
.line-text :deep(.tgc-figurine) {
  font-family: 'Chess The Good Companions', sans-serif;
  font-weight: normal;
  font-size: 1.05em;
  line-height: 1;
  margin-right: 1px;
  vertical-align: 1px;
}
.sheet-enter-active, .sheet-leave-active { transition: background-color 0.22s; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 0.22s ease-out; }
.sheet-enter-from, .sheet-leave-to { background-color: transparent; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(100%); }
</style>
