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
          :caption-editable="isCaptionEditable" @size="setSizeLevel" @align="setAlign"
          @toggle-caption="toggleOrFocusCaption" @flip="toggleFlip" @load-on-board="loadOnBoard"
          @paragraph="insertParagraph" @remove="deleteNode" />

        <pre class="chess-pure-text">{{ boardString }}</pre>

        <ShapesOverlay :shapes="node.attrs.shapes" :flipped="flipped" />
      </div>

      <!-- Didascalia del diagramma -->
      <node-view-content ref="captionRef"
        class="diagram-caption"
        :class="{ 'is-editing': isCaptionEditable }"
        :contenteditable="isCaptionEditable && !store.isLocked"
        @blur="disableCaptionEditing"
        @keydown.enter="onCaptionEnter"
        placeholder="Diagramma X: inserisci didascalia..." />
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { nodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3'
import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { usePageLayout } from '../composables/usePageLayout'
import { badgeReservePx, normalizeSizeLevel, diagramFontPx, type DiagramSizeLevel } from '../utils/diagramSizes'
import { isLegalFen } from '../utils/fen'
import { fenToBoardString } from '../utils/chessFormatter'
import { useInsertParagraph } from '../composables/useInsertParagraph'
import DiagramActionsMenu from './diagram/DiagramActionsMenu.vue'
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
const captionRef = ref<InstanceType<typeof NodeViewContent> | null>(null)
const isCaptionEditable = computed(() => props.node.attrs.captionEditable !== false)

// Clic fuori dalla didascalia (blur): l'editing si disattiva
const disableCaptionEditing = () => props.updateAttributes({ captionEditable: false })

// Invio nella didascalia = conferma. L'evento si ferma qui, prima di ProseMirror: altrimenti
// lo split di blocco di default creerebbe un nuovo paragrafo. Maiusc+Invio (a capo) resta com'è.
const onCaptionEnter = (event: KeyboardEvent) => {
  if (event.isComposing || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
  event.preventDefault()
  event.stopPropagation()
  ;(event.currentTarget as HTMLElement | null)?.blur()
  disableCaptionEditing()
}

// Attiva o disattiva la didascalia, poi la mette a fuoco con il testo selezionato
const toggleOrFocusCaption = async () => {
  if (!isCaptionEditable.value) props.updateAttributes({ captionEditable: true })
  else disableCaptionEditing()

  await nextTick()

  const el = captionRef.value?.$el as HTMLElement | undefined
  if (!el) return
  // Si mette a fuoco il contenitore interno di Tiptap
  ;((el.querySelector('[data-node-view-content-vue]') || el) as HTMLElement).focus()

  // Si seleziona tutto il testo per sovrascriverlo facilmente
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
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
  cursor: default;
  user-select: text !important;
  -webkit-user-select: text !important;
}

/* Evidenzia il rettangolo della didascalia quando è attiva o sotto focus */
.diagram-caption:focus,
.diagram-caption:hover {
  background-color: color-mix(in srgb, var(--t-accent-wash) 70%, transparent);
  border-color: color-mix(in srgb, var(--t-accent), #ffffff 80%);
}

.diagram-caption.is-editing {
  cursor: text;
  background-color: color-mix(in srgb, var(--t-accent-wash) 70%, transparent);
  border-color: color-mix(in srgb, var(--t-accent), #ffffff 80%);
  user-select: text !important;
  -webkit-user-select: text !important;
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