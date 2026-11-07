<template>
  <div class="space-y-1">
    <div class="flex justify-between items-center">
      <span class="text-[11px] font-medium text-neutral-400">Notazione FEN corrente:</span>
      <button @click="copyFenToClipboard" v-tooltip.desc="'Copia negli appunti il FEN della posizione sulla scacchiera'"
        class="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 transition flex items-center gap-1">
        {{ copied ? 'Copiato!' : 'Copia FEN' }}
      </button>
    </div>
    <input type="text" :value="currentFen" :readonly="fenReadonly" @change="handleFenChange"
      aria-label="Notazione FEN corrente" v-tooltip.desc="fenTitle"
      class="w-full font-mono text-[11px] bg-neutral-900 text-neutral-300 p-2 rounded break-all focus:outline-none focus:ring-1 focus:ring-neutral-500 select-all leading-relaxed border border-neutral-800"
      :class="{ 'opacity-70 cursor-default': fenReadonly }" />
    <button type="button" :disabled="fenReadonly" @click="emit('edit')" v-tooltip.desc="editorTitle"
      class="w-full py-1.5 bg-white hover:bg-neutral-50 text-neutral-700 rounded text-xs font-semibold border border-neutral-300 transition disabled:opacity-40 disabled:cursor-not-allowed">
      <i class="fa-solid fa-pen-to-square"></i> Editor scacchiera
    </button>
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
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useChessTreeStore } from '../../stores/chessTreeStore'
import { useChessBookStore } from '../../stores/chessBookStore'
import { vTooltip } from '../../directives/tooltip'

const props = defineProps<{ currentFen: string }>()
const emit = defineEmits<{ (e: 'updateFen', fen: string): void; (e: 'edit'): void }>()

const treeStore = useChessTreeStore()
const bookStore = useChessBookStore()

const tree = computed(() => treeStore.currentTree)
const fenLocked = computed(() => treeStore.isFenLocked)
// Sola lettura: la posizione iniziale dell'albero del documento non si cambia
const locked = computed(() => bookStore.isLocked)
const fenReadonly = computed(() => fenLocked.value || (locked.value && !!tree.value))

// Il motivo del blocco è già scritto sotto: il tooltip dice cosa fare quando il campo è modificabile
const readonlyReason = computed(() => fenLocked.value
  ? 'Posizione iniziale già fissata: per partire da un’altra posizione crea un nuovo albero'
  : 'Documento in sola lettura: la posizione iniziale non è modificabile')
const fenTitle = computed(() => fenReadonly.value ? readonlyReason.value
  : tree.value ? 'Incolla un FEN e premi Invio: diventa la posizione iniziale di questo albero'
    : 'Incolla o scrivi un FEN e premi Invio per portare la scacchiera su quella posizione')
const editorTitle = computed(() => fenReadonly.value ? readonlyReason.value
  : 'Disponi i pezzi a mano, con tratto, arrocchi e numero di mossa')

const copied = ref(false)
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
