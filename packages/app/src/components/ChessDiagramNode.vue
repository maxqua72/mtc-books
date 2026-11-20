<template>
  <node-view-wrapper class="chess-diagram-container avoid-break" :data-align="align" :style="containerStyle">
    <div class="diagram-card" :style="{ '--diagram-size': currentSizePx + 'px' }">

      <div class="board-wrapper" contenteditable="false" style="position: relative">

        <!-- Etichetta numero diagramma (es. 1.1, 1.2) -->
        <div v-if="diagramNumber" class="diagram-number-badge" title="Numero diagramma">
          <div class="badge-text">{{ diagramNumber }}</div>
        </div>

        <!-- Indicatore del tratto -->
        <div class="turn-indicator" :class="activeColor"
          :title="activeColor === 'white' ? 'Mossa al Bianco' : 'Mossa al Nero'"></div>

        <DiagramActionsMenu v-if="!store.isLocked" :size-level="sizeLevel" :align="align" :flipped="flipped"
          :show-align="!layout.twoColumns.value"
          :caption-active="captionActive" :pair-state="pairState" @size="setSizeLevel" @align="setAlign" @pair="pairWithPrevious"
          @edit-caption="editCaption" @flip="toggleFlip" @load-on-board="loadOnBoard"
          @paragraph="insertParagraph" @remove="deleteNode" />

        <pre class="chess-pure-text">{{ boardString }}</pre>

        <ShapesOverlay :shapes="node.attrs.shapes" :flipped="flipped" />
      </div>

      <!-- Didascalia del diagramma: attiva (bordo, sfondo, segnaposto) quando il cursore è dentro.
           Invio conferma e porta il cursore fuori (ProtectChessNodes) -->
      <node-view-content
        class="diagram-caption"
        :class="{ 'is-editing': captionActive }"
        placeholder="Diagramma X: inserisci didascalia..." />
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { nodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3'
import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { usePageLayout } from '../composables/usePageLayout'
import { badgeReservePx, normalizeSizeLevel, diagramFontPx, type DiagramSizeLevel } from '../utils/diagramSizes'
import { isLegalFen } from '../utils/fen'
import { fenToBoardString } from '../utils/chessFormatter'
import { useInsertParagraph } from '../composables/useInsertParagraph'
import { leaveCaption } from '../extensions/ProtectChessNodes'
import DiagramActionsMenu from './diagram/DiagramActionsMenu.vue'
import { blockStart, describeBlocks, planPair } from '../utils/diagramRows'
import ShapesOverlay from './diagram/ShapesOverlay.vue'

const store = useChessBookStore()
const treeStore = useChessTreeStore()
const props = defineProps(nodeViewProps)

const insertParagraph = useInsertParagraph(props)
const layout = usePageLayout()

// --- Attributi del nodo ---
const flipped = computed(() => !!props.node.attrs.flipped)
const toggleFlip = () => props.updateAttributes({ flipped: !flipped.value })

const sizeLevel = computed<DiagramSizeLevel>(() => normalizeSizeLevel(props.node.attrs.size))
const currentSizePx = computed(() => diagramFontPx(sizeLevel.value, store.metadata.pageFormat,
  layout.twoColumns.value ? layout.columnWidthMm.value : undefined))
// 'medium' è il valore predefinito: si salva come null
const setSizeLevel = (level: DiagramSizeLevel) => props.updateAttributes({ size: level === 'medium' ? null : level })

// A due colonne il diagramma è sempre centrato; l'allineamento salvato torna valido a colonna unica
const align = computed<'left' | 'center' | 'right'>(() => {
  if (layout.twoColumns.value) return 'center'
  const value = props.node.attrs.align
  return value === 'left' || value === 'right' ? value : 'center'
})
const setAlign = (value: 'left' | 'center' | 'right') => props.updateAttributes({ align: value })

// A chi spetta la mossa: secondo campo del FEN ('b' = Nero, altrimenti Bianco)
const activeColor = computed(() => props.node.attrs.fen.trim().split(/\s+/)[1] === 'b' ? 'black' : 'white')

const boardString = computed(() => fenToBoardString(props.node.attrs.fen, flipped.value))

const diagramNumber = computed(() => store.diagramLabels.get(props.node.attrs.id)?.label ?? '')

// Spazio a sinistra della scacchiera per badge e pallino (che sono position:absolute).
// Serve con il diagramma a margine: il box float deve includerli,
// altrimenti escono dal foglio (sinistra) o finiscono sotto il testo (destra).
// Serve anche a due colonne: altrimenti invaderebbero il margine o la colonna accanto.
const containerStyle = computed(() => {
  if (align.value === 'center' && !layout.twoColumns.value) return {}
  return { paddingLeft: badgeReservePx(currentSizePx.value, diagramNumber.value) + 'px' }
})

// Porta posizione e orientamento del diagramma sulla scacchiera, in modalità libera (nessun albero collegato)
const loadOnBoard = () => {
  const fen = props.node.attrs.fen as string
  if (!isLegalFen(fen)) {
    alert('La posizione di questo diagramma non è una posizione legale: impossibile caricarla.')
    return
  }
  treeStore.deactivateTree()
  treeStore.setBoardFen(fen)
  treeStore.boardFlipped = flipped.value
}

// --- Didascalia ---
// Attiva quando il cursore dell'editor è dentro la didascalia (e l'editor ha il fuoco): non è uno stato
// del documento, quindi non si salva e non entra nella cronologia di annulla
const captionActive = ref(false)
const syncCaptionActive = () => {
  const ed = props.editor
  const pos = typeof props.getPos === 'function' ? props.getPos() : undefined
  if (typeof pos !== 'number' || !ed.isEditable || !ed.isFocused) {
    captionActive.value = false
    return
  }
  const { from, to } = ed.state.selection
  captionActive.value = from > pos && to < pos + props.node.nodeSize
}
// --- Fila con il diagramma precedente ---
const nodeIndex = (): number | null => {
  const pos = typeof props.getPos === 'function' ? props.getPos() : undefined
  if (typeof pos !== 'number') return null
  const $pos = props.editor.state.doc.resolve(pos)
  return $pos.depth === 0 ? $pos.index(0) : null   // solo diagrammi di primo livello
}
const pairState = ref<'none' | 'available' | 'done'>('none')
const syncPairState = () => {
  const i = nodeIndex()
  const plan = i === null ? null : planPair(describeBlocks(props.editor.state.doc), i)
  pairState.value = !plan ? 'none' : plan.done ? 'done' : 'available'
}

// In una sola transazione (un solo Ctrl+Z): precedente a sinistra, questo a destra con la stessa dimensione,
// via il paragrafo vuoto in mezzo, così la fila si forma (vedi book-typography.css)
const pairWithPrevious = () => {
  const i = nodeIndex()
  if (i === null || store.isLocked) return
  const doc = props.editor.state.doc
  const plan = planPair(describeBlocks(doc), i)
  if (!plan || plan.done) return
  const prevPos = blockStart(doc, plan.previous)
  const thisPos = blockStart(doc, i)
  const prev = doc.child(plan.previous)
  props.editor.chain().command(({ tr }) => {
    tr.setNodeMarkup(thisPos, undefined, { ...props.node.attrs, align: 'right', size: prev.attrs.size ?? null })
    tr.setNodeMarkup(prevPos, undefined, { ...prev.attrs, align: 'left' })
    if (plan.emptyBetween !== null) {
      const from = blockStart(doc, plan.emptyBetween)
      tr.delete(from, from + doc.child(plan.emptyBetween).nodeSize)
    }
    return true
  }).run()
}

const syncState = () => { syncCaptionActive(); syncPairState() }
const EVENTS = ['selectionUpdate', 'transaction', 'focus', 'blur'] as const
onMounted(() => { EVENTS.forEach(e => props.editor.on(e, syncState)); syncState() })
onBeforeUnmount(() => EVENTS.forEach(e => props.editor.off(e, syncState)))

// Pulsante del menu, interruttore: con la didascalia non attiva porta il cursore alla sua fine;
// con la didascalia attiva conferma come Invio (il cursore va nel testo dopo il diagramma)
const editCaption = () => {
  const pos = typeof props.getPos === 'function' ? props.getPos() : undefined
  if (typeof pos !== 'number' || store.isLocked) return
  const end = pos + props.node.nodeSize
  if (captionActive.value) leaveCaption(props.editor, end)
  else props.editor.chain().focus().setTextSelection(end - 1).run()
}
</script>

<style scoped>
.chess-diagram-container {
  margin: 2rem 0;
  margin-top: var(--diagram-spacing, 5mm) !important;
  margin-bottom: var(--diagram-spacing, 5mm) !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.diagram-card {
  position: relative;
  background-color: transparent;
  padding: 0.5rem 0;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.board-wrapper {
  position: relative;
  /* Base per il posizionamento del menu */
  display: inline-block;
  /* Si stringe esattamente attorno alla larghezza del testo della scacchiera */
  margin: 0 auto;
  user-select: none !important;
  -webkit-user-select: none !important;
}

/* LA SCACCHIERA DI PURO TESTO CON LE COORDINATE DENTRO */
.chess-pure-text {
  font-family: 'Chess Merida', serif !important;
  font-size: var(--diagram-size) !important;
  line-height: var(--diagram-size) !important;
  overflow: visible !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  overflow: hidden;
  white-space: pre;
  color: #000000;
  text-align: center;
  /* Un piccolo padding inferiore di sicurezza */
  padding-bottom: 4px !important;
}

.diagram-caption {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 0.75rem;
  text-align: center;
  color: #525252;
  margin-top: 0;
  font-style: italic;
  max-width: 360px;
  outline: none;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.15s, border-color 0.15s;
  border: 1px transparent solid;
  cursor: text;
  user-select: text !important;
  -webkit-user-select: text !important;
}

/* Al passaggio del mouse solo un bordo leggero: si capisce che è cliccabile */
.diagram-caption:hover {
  border-color: color-mix(in srgb, var(--t-accent), #ffffff 80%);
}

/* Attiva (cursore dentro): bordo e sfondo */
.diagram-caption.is-editing {
  background-color: color-mix(in srgb, var(--t-accent-wash) 70%, transparent);
  border-color: color-mix(in srgb, var(--t-accent), #ffffff 80%);
}

/* ETICHETTA NUMERO DIAGRAMMA IN ALTO A SINISTRA */
.diagram-number-badge {
  position: absolute;
  top: calc(var(--diagram-size) * 1.07);

  /* Ancoraggio al bordo sinistro del wrapper della scacchiera */
  right: 100%; 
  /* Distanza fissa dal margine sinistro della scacchiera */
  margin-right: 10px;

  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: calc(var(--diagram-size) * 0.8);
  font-weight: 700;
  color: white;
  background-color: black;
  padding: 2px 6px;
  white-space: nowrap;
  user-select: none;
  text-align: right;
}

/* POSIZIONAMENTO DELL'INDICATORE DEL TRATTO */
.turn-indicator {
  position: absolute;
  /* Allinea verticalmente con il numero '8' della scacchiera */
  top: calc(var(--diagram-size) * 2.8);

  /* Ancoraggio a destra per allinearlo visivamente al centro del badge sopra */
  right: 100%;
  margin-right: 10px;
  
  width: calc(var(--diagram-size) * 0.8);
  height: calc(var(--diagram-size) * 0.8);
  border-radius: 50%;
  box-sizing: border-box;
  transition: all 0.2s ease;
  z-index: 2;
}

/* Mossa al Bianco: Cerchio vuoto con bordo nero nitido */
.turn-indicator.white {
  background-color: #ffffff;
  border: 2px solid #000000;
}

/* Mossa al Nero: Cerchio pieno nero */
.turn-indicator.black {
  background-color: #000000;
  border: 2px solid #000000;
}

/* Diagramma a margine: il testo che segue scorre accanto */
.chess-diagram-container[data-align="left"],
.chess-diagram-container[data-align="right"] {
  display: block;
  width: max-content;
  margin-top: 0 !important;
  /* Il paragrafo o l'albero selezionato accanto è posizionato (barra di selezione) e largo quanto il foglio:
     senza questo starebbe sopra il diagramma e si prenderebbe i clic sulla didascalia */
  position: relative;
  z-index: 1;
}
.chess-diagram-container[data-align="left"] {
  float: left;
  margin-right: var(--diagram-side-gap, 6mm);
}
.chess-diagram-container[data-align="right"] {
  float: right;
  margin-left: var(--diagram-side-gap, 6mm);
}

/* La didascalia segue la larghezza della scacchiera, non la allarga */
.chess-diagram-container[data-align="left"] .diagram-caption,
.chess-diagram-container[data-align="right"] .diagram-caption {
  width: 0;
  min-width: 100%;
}

</style>