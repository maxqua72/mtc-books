<template>
  <div class="w-full max-w-[400px] bg-white border border-neutral-200 rounded-lg p-4 shadow-sm space-y-3">
    <div class="flex items-center justify-between border-b border-neutral-100 pb-2">
      <span class="text-xs font-bold text-neutral-400 uppercase tracking-wider">Editor scacchiera</span>
      <button type="button" @click="emit('flip')" v-tooltip.desc="'Inverti la scacchiera'"
        class="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition underline underline-offset-4">
        Inverti
      </button>
    </div>

    <div class="space-y-1">
      <div v-for="color in COLORS" :key="color" class="flex gap-1">
        <button v-for="role in ROLES" :key="role" type="button" class="tool-btn"
          :class="{ active: isTool(color, role) }" v-tooltip="`${pieceLabel(role)} ${color === 'white' ? 'bianco' : 'nero'}`"
          :aria-pressed="isTool(color, role)" @mousedown.left.prevent="emit('dragPiece', { color, role }, $event)"
          @touchstart="emit('dragPiece', { color, role }, $event)" @click="toggleTool({ color, role })">
          <span class="cg-wrap cburnett tool-cell">
            <component :is="'piece'" class="tool-piece" :class="[role, color]" />
          </span>
        </button>
      </div>
      <div class="flex gap-1">
        <button type="button" class="tool-btn tool-text" :class="{ active: tool === null }" :aria-pressed="tool === null"
          v-tooltip.desc="'Trascina i pezzi sulla scacchiera; fuori dalla scacchiera vengono rimossi'" @click="emit('update:tool', null)">
          <i class="fa-solid fa-arrow-pointer"></i> Sposta
        </button>
        <button type="button" class="tool-btn tool-text" :class="{ active: tool === 'trash' }" :aria-pressed="tool === 'trash'"
          v-tooltip.desc="'Clic su una casa per togliere il pezzo'" @click="emit('update:tool', 'trash')">
          <i class="fa-solid fa-trash-can"></i> Togli
        </button>
      </div>
      <p class="text-[11px] text-neutral-500 leading-snug">
        Trascina un pezzo sulla scacchiera, oppure sceglilo e clicca sulle case.
      </p>
    </div>

    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-neutral-600">
      <label class="block">Tratto
        <select v-model="options.turn" class="w-full text-xs border border-neutral-200 rounded px-2 py-1 bg-white">
          <option value="w">Bianco</option>
          <option value="b">Nero</option>
        </select>
      </label>
      <label class="block">Mossa numero
        <input v-model.number="options.moveNumber" type="number" min="1" step="1"
          class="w-full text-xs border border-neutral-200 rounded px-2 py-1 bg-white" />
      </label>
      <label v-for="c in CASTLES" :key="c.key" class="flex items-center gap-1.5"
        :class="{ 'opacity-40': !available[c.key] }"
        v-tooltip.desc="available[c.key] ? null : 'Non disponibile: re o torre non sono sulla casa iniziale'">
        <input type="checkbox" :disabled="!available[c.key]" :checked="options.castling[c.key] && available[c.key]"
          @change="options.castling[c.key] = ($event.target as HTMLInputElement).checked" />
        {{ c.label }}
      </label>
    </div>

    <div class="flex gap-2">
      <button type="button" class="action-btn" @click="setStandard"
        v-tooltip.desc="'Dispone i pezzi come all’inizio della partita'">Posizione iniziale</button>
      <button type="button" class="action-btn" @click="emit('setPlacement', EMPTY_PLACEMENT)"
        v-tooltip.desc="'Toglie tutti i pezzi dalla scacchiera'">Svuota</button>
    </div>

    <div class="space-y-1">
      <input type="text" readonly :value="fen" aria-label="FEN della posizione"
        class="w-full font-mono text-[11px] bg-neutral-900 text-neutral-300 p-2 rounded border border-neutral-800 focus:outline-none" />
      <p class="min-h-4 text-[11px]" :class="error ? 'text-red-600 font-medium' : 'text-neutral-500'" aria-live="polite">
        {{ error ?? validHint ?? (hasTree ? 'Diventerà la posizione iniziale di questo albero.' : 'Posizione valida.') }}
      </p>
    </div>

    <div class="flex gap-2">
      <button type="button" :disabled="!!error" @click="emit('apply', fen)"
        v-tooltip.desc="error ? error : hasTree ? 'Diventa la posizione iniziale di questo albero' : 'Porta la scacchiera su questa posizione'"
        class="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-bold uppercase tracking-wide transition disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed">
        {{ applyLabel ?? 'Applica' }}
      </button>
      <button type="button" @click="emit('cancel')"
        class="flex-1 py-2 bg-white hover:bg-neutral-50 text-neutral-700 rounded text-xs font-bold uppercase tracking-wide transition border border-neutral-300"
        v-tooltip.desc="'Chiude l\'editor senza cambiare la posizione (Esc)'">
        Annulla
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { Color, Role } from 'chessground/types'
import {
  EMPTY_PLACEMENT, STANDARD_PLACEMENT, availableCastling, composeFen, parseEditorOptions, positionError,
  type CastlingRights, type EditorTool,
} from '../../utils/boardEditor'
import { STANDARD_FEN } from '../../utils/fen'
import { vTooltip } from '../../directives/tooltip'

const props = defineProps<{
  startFen: string
  placement: string          // pezzi attualmente sulla scacchiera
  tool: EditorTool
  hasTree: boolean
  applyLabel?: string        // Taccuino: «Inserisci diagramma»
  validHint?: string         // testo sotto il FEN quando la posizione è valida
}>()

const emit = defineEmits<{
  (e: 'update:tool', tool: EditorTool): void
  (e: 'setPlacement', placement: string): void
  (e: 'dragPiece', piece: { color: Color; role: Role }, event: MouseEvent | TouchEvent): void
  (e: 'flip'): void
  (e: 'apply', fen: string): void
  (e: 'cancel'): void
}>()

const COLORS: Color[] = ['white', 'black']
const ROLES: Role[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']
const LABELS: Record<Role, string> = {
  king: 'Re', queen: 'Donna', rook: 'Torre', bishop: 'Alfiere', knight: 'Cavallo', pawn: 'Pedone',
}
const pieceLabel = (role: Role) => LABELS[role]

const CASTLES: { key: keyof CastlingRights; label: string }[] = [
  { key: 'K', label: 'Bianco O-O' },
  { key: 'Q', label: 'Bianco O-O-O' },
  { key: 'k', label: 'Nero O-O' },
  { key: 'q', label: 'Nero O-O-O' },
]

const options = reactive(parseEditorOptions(props.startFen))
const available = computed(() => availableCastling(props.placement))
const fen = computed(() => composeFen(props.placement, options))
const error = computed(() => positionError(fen.value))

// Il Taccuino legge la posizione composta per far partire la linea di mosse
defineExpose({ fen, error })

const isTool = (color: Color, role: Role) =>
  typeof props.tool === 'object' && props.tool?.color === color && props.tool.role === role

// Si sceglie con il clic: un trascinamento posa il pezzo senza cambiare lo strumento
const toggleTool = (piece: { color: Color; role: Role }) =>
  emit('update:tool', isTool(piece.color, piece.role) ? null : piece)

function setStandard() {
  Object.assign(options, parseEditorOptions(STANDARD_FEN))
  emit('setPlacement', STANDARD_PLACEMENT)
}
</script>

<style scoped>
.tool-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 1px solid var(--color-neutral-200, #e5e5e5);
  border-radius: 0.25rem;
  background: var(--color-neutral-50, #fafafa);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.tool-btn:hover { background: var(--color-neutral-100, #f5f5f5); }
.tool-btn.active {
  border-color: var(--color-neutral-900, #171717);
  box-shadow: inset 0 0 0 1px var(--color-neutral-900, #171717);
}
.tool-text {
  padding: 0.25rem;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-neutral-700, #404040);
}
.tool-cell {
  display: block;
  position: relative;
  width: 44px;
  height: 44px;
}
/* Il CSS base di Chessground posiziona i pezzi in assoluto al 12,5%: qui devono riempire la cella */
.tool-piece {
  position: relative !important;
  display: block;
  width: 100% !important;
  height: 100% !important;
  background-size: cover;
  pointer-events: none;
  transform: none !important;
}
.action-btn {
  flex: 1;
  padding: 0.375rem 0.25rem;
  border: 1px solid var(--color-neutral-300, #d4d4d4);
  border-radius: 0.25rem;
  background: var(--color-neutral-50, #fafafa);
  color: var(--color-neutral-700, #404040);
  font-size: 11px;
  font-weight: 600;
  transition: background 0.15s;
}
.action-btn:hover { background: var(--color-neutral-100, #f5f5f5); }
</style>
