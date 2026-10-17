<template>
  <node-view-wrapper class="chess-diagram-container avoid-break" :data-align="align" :style="containerStyle">
    <div class="diagram-card" 
    :style="{ '--diagram-size': currentSizePx + 'px' }">

      <!-- Spostiamo il menu dentro il wrapper per ancorarlo al testo reale -->
      <div class="board-wrapper" contenteditable="false">

        <!-- NUOVO: Etichetta Numero Diagramma (es. 1.1, 1.2) -->
        <div v-if="diagramNumber"
          class="diagram-number-badge" title="Numero diagramma">
          <div class="badge-text">{{ diagramNumber }}</div>
        </div>

        <!-- Indicatore del tratto nell'angolo in alto a sinistra del diagramma -->
        <div 
          class="turn-indicator" 
          :class="activeColor"
          :title="activeColor === 'white' ? 'Mossa al Bianco' : 'Mossa al Nero'"
        ></div>

        <!-- Action Bar in stile Gmail a comparsa (in alto a destra del bordo scacchiera) -->
        <div class="diagram-actions-menu">
          <!-- Bottone Dimensione Piccola -->
          <button @click="setSizeLevel('small')" :class="{ active: sizeLevel === 'small' }"
            title="Dimensione piccola" class="action-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>

          <!-- Bottone Dimensione Media -->
          <button @click="setSizeLevel('medium')" :class="{ active: sizeLevel === 'medium' }"
            title="Dimensione media" class="action-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>

          <!-- Bottone Dimensione Grande -->
          <button @click="setSizeLevel('large')" :class="{ active: sizeLevel === 'large' }"
            title="Dimensione grande" class="action-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="20" rx="2" />
            </svg>
          </button>

          <div class="action-divider"></div>

          <button @click="setAlign('left')" :class="{ active: align === 'left' }"
            title="A sinistra: il testo scorre accanto" class="action-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="3" y="3" width="8" height="8" rx="1" />
              <path d="M15 5h6M15 9h6M3 15h18M3 19h18" />
            </svg>
          </button>
          <button @click="setAlign('center')" :class="{ active: align === 'center' }"
            title="Al centro" class="action-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="8" y="3" width="8" height="8" rx="1" />
              <path d="M3 15h18M3 19h18" />
            </svg>
          </button>
          <button @click="setAlign('right')" :class="{ active: align === 'right' }"
            title="A destra: il testo scorre accanto" class="action-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="13" y="3" width="8" height="8" rx="1" />
              <path d="M3 5h6M3 9h6M3 15h18M3 19h18" />
            </svg>
          </button>

          <div class="action-divider"></div>

          <button @click="toggleOrFocusCaption" :class="{ active: isCaptionEditable }" title="Modifica didascalia"
            class="action-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>

          <!-- Tasto di eliminazione (Icona Cestino) -->
          <button @click="deleteNode" class="action-btn delete-btn-icon" title="Elimina diagramma">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>

        <pre class="chess-pure-text">{{ boardString }}</pre>
      </div>

      <!-- Didascalia del diagramma -->
      <node-view-content ref="captionRef" 
        class="diagram-caption" 
        :class="{ 'is-editing': isCaptionEditable }"
        :contenteditable="isCaptionEditable"
        @blur="disableCaptionEditing"
        placeholder="Diagramma X: inserisci didascalia..." />
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { nodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3'
import { useChessBookStore } from '../stores/chessBookStore'
import { normalizeSizeLevel, diagramFontPx, type DiagramSizeLevel } from '../utils/diagramSizes'
import { fenToBoardString } from '../utils/chessFormatter'

const store = useChessBookStore()
const props = defineProps(nodeViewProps)

// Ref per accedere all'elemento DOM della didascalia
const captionRef = ref<InstanceType<typeof NodeViewContent> | null>(null)

  // Verifica se la didascalia è attiva
const isCaptionEditable = computed(() => {
  return props.node.attrs.captionEditable !== false
})

// 3. Quando l'utente clicca fuori dalla didascalia (blur), disattiviamo l'editing
const disableCaptionEditing = () => {
  props.updateAttributes({ captionEditable: false })
}

// Funzione per attivare e mettere a fuoco la didascalia
const toggleOrFocusCaption = async () => {
  if (!isCaptionEditable.value) {
    props.updateAttributes({ captionEditable: true })
  } else {
    disableCaptionEditing()
  }
  
  await nextTick()

  // Seleziona ed evidenzia il testo della didascalia per la modifica immediata
  if (captionRef.value && captionRef.value.$el) {
    const el = captionRef.value.$el as HTMLElement
    // Mettiamo a fuoco direttamente il contenitore interno di TipTap
    const innerChild = (el.querySelector('[data-node-view-content-vue]') || el) as HTMLElement
    innerChild.focus()
    
    // Seleziona tutto il testo presente per sovrascriverlo facilmente
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }
}

const sizeLevel = computed<DiagramSizeLevel>(() => normalizeSizeLevel(props.node.attrs.size))
const currentSizePx = computed(() => diagramFontPx(sizeLevel.value, store.metadata.pageFormat))

const setSizeLevel = (level: DiagramSizeLevel) => {
  // 'medium' è il valore predefinito: si salva come null
  props.updateAttributes({ size: level === 'medium' ? null : level })
}

const align = computed<'left' | 'center' | 'right'>(() => {
  const value = props.node.attrs.align
  return value === 'left' || value === 'right' ? value : 'center'
})
const setAlign = (value: 'left' | 'center' | 'right') => props.updateAttributes({ align: value })

/*
// Usa il getter centralizzato dallo store per il numero del capitolo
const chapterNumber = computed(() => store.currentChapterNumber)
// Calcola il numero progressivo del diagramma all'interno del capitolo
const diagramIndex = computed(() => {
  if (!props.editor) return 1
  
  let count = 0
  let currentIndex = 1

  props.editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'chessDiagram') {
      count++
      if (pos === props.getPos()) {
        currentIndex = count
      }
    }
  })

  return currentIndex
})
  

const diagramNumber = computed(() => `${chapterNumber.value}.${diagramIndex.value}`)

// 1. Calcolo dinamico: priorità alla dimensione locale, altrimenti globale


const isDarkSquare = (row: number, col: number) => {
  return (row + col) % 2 === 1
}
  */

const diagramNumber = computed(() =>
  store.diagramLabels.get(props.node.attrs.id)?.label ?? ''
)

// Spazio a sinistra della scacchiera per badge e pallino (che sono position:absolute).
// Serve solo con il diagramma a margine: il box float deve includerli,
// altrimenti escono dal foglio (sinistra) o finiscono sotto il testo (destra).
const containerStyle = computed(() => {
  if (align.value === 'center') return {}
  const chars = Math.max(diagramNumber.value.length, 4)       // "12.34" nel caso peggiore
  const badgeFontPx = currentSizePx.value * 0.8               // come font-size del badge
  const badgeWidthPx = badgeFontPx * 0.6 * chars + 12         // ~0.6em a carattere + padding 2×6px
  const gutterPx = Math.ceil(badgeWidthPx + 10)               // + margin-right del badge
  return { paddingLeft: gutterPx + 'px' }
})

// Analizza il secondo parametro della FEN per determinare a chi spetta la mossa ('w' o 'b')
const activeColor = computed(() => {
  const fenParts = props.node.attrs.fen.trim().split(/\s+/)
  // Se il parametro manca o non è 'b', assume che la mossa sia del Bianco ('w')
  return fenParts[1] === 'b' ? 'black' : 'white'
})

/*
const boardString = computed(() => {
  const fenRows = props.node.attrs.fen.split(' ')[0].split('/')

  const keymap: Record<string, { light: string; dark: string }> = {
    'P': { light: 'p', dark: 'P' }, 'p': { light: 'o', dark: 'O' },
    'N': { light: 'n', dark: 'N' }, 'n': { light: 'm', dark: 'M' },
    'B': { light: 'b', dark: 'B' }, 'b': { light: 'v', dark: 'V' },
    'R': { light: 'r', dark: 'R' }, 'r': { light: 't', dark: 'T' },
    'Q': { light: 'q', dark: 'Q' }, 'q': { light: 'w', dark: 'W' },
    'K': { light: 'k', dark: 'K' }, 'k': { light: 'l', dark: 'L' }
  }

  

  // 1. Cornice Superiore fissa
  let output = '1222222223\n'

  // Caratteri reali UTF-8 corrispondenti ai codici ASCII 199-192 (Traverse da 8 a 1)
  // Questo evita di chiamare String.fromCharCode ad ogni riga nel loop
  //const leftBorders = ['Ã', 'Â', 'Å', 'Ä', 'Ã\u0083', 'Â\u0082', '\u00C5', '\u00C4'] // Corrispettivi di [199, 198, 197, 196, 195, 194, 193, 192] a seconda dell'encoding

  // Se preferisci usare direttamente l'array di codici numerici nativi senza ambiguità:
  const leftBorderCodes = [199, 198, 197, 196, 195, 194, 193, 192]

  // 2. Generazione delle 8 Traverse Centrali
  fenRows.forEach((fenRow: string, rowIndex: number) => {
    let rowText = String.fromCharCode(leftBorderCodes[rowIndex])
    let colIndex = 0

    for (const char of fenRow) {
      if (isNaN(Number(char))) {
        const dark = isDarkSquare(rowIndex, colIndex)
        rowText += dark ? keymap[char].dark : keymap[char].light
        colIndex++
      } else {
        const emptyCount = Number(char)
        for (let i = 0; i < emptyCount; i++) {
          const dark = isDarkSquare(rowIndex, colIndex)
          rowText += dark ? '+' : ' '
          colIndex++
        }
      }
    }

    // Chiusura di ogni riga col bordo destro fisso '5'
    output += rowText + '5\n'
  })

  // 3. Cornice Inferiore fissa (7 + caratteri da 200 a 207 + 9)[cite: 1]
  // Generata in stringa statica per non appesantire l'esecuzione con cicli ad ogni render
  const bottomCoords = 'ÈÉÊËÌÍÎÏ'
  output += `7${bottomCoords}9`

  return output
}) */
const boardString = computed(() => fenToBoardString(props.node.attrs.fen, !!props.node.attrs.flipped))
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
  /* Rende invisibile lo sfondo del riquadro */
  padding: 0.5rem 0;
  /* Mantiene solo un leggero distacco sopra/sotto */
  border: none;
  /* Rimuove il bordo grigio */
  border-radius: 0;
  /* Rimuove gli angoli arrotondati */
  box-shadow: none;
  /* Rimuove l'ombra */
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

/* MENU IN STILE GMAIL ANCORATO SENZA SPAZI VUOTI */
/* CONFIGURAZIONE PERFETTAMENTE ALLINEATA ALLA SCACCHIERA */
.diagram-actions-menu {
  position: absolute;
  /* Sposta il menu verso l'alto per allinearlo alla prima linea nera della scacchiera */
  top: 4px;
  /* Avvicina il menu al bordo destro, riducendo la distanza precedente */
  right: -12px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  background-color: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
  padding: 2px;

  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
  z-index: 30;
}

/* PONTE INVISIBILE: Mantiene l'hover attivo nel micro-spazio rimasto */
.diagram-actions-menu::before {
  content: '';
  position: absolute;
  top: -10px;
  bottom: -10px;
  left: -15px;
  /* Copre lo spazio vuoto a sinistra */
  right: 0;
  background: transparent;
  z-index: -1;
}

/* Attivazione al passaggio del mouse sulla card */
.diagram-card:hover .diagram-actions-menu {
  opacity: 1;
  pointer-events: auto;
}

/* Bottoni interni */
.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #525252;
  cursor: pointer;
  transition: background-color 0.1s, color 0.1s;
}

.action-btn:hover {
  background-color: #f5f5f5;
  color: #171717;
}

.action-btn.active {
  background-color: #e5e5e5;
  color: #171717;
}

.delete-btn-icon:hover {
  background-color: #fee2e2;
  color: #dc2626;
}

.action-divider {
  height: 1px;
  background-color: #e5e5e5;
  margin: 2px 4px;
}

.diagram-caption {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 0.75rem;
  text-align: center;
  color: #525252;
  margin-top: 0.5rem;
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
  background-color: #f8fafc;
  border-color: #e2e8f0;
}

.diagram-caption.is-editing {
  cursor: text;
  background-color: #f8fafc;
  border-color: #cbd5e1;
  user-select: text !important;
  -webkit-user-select: text !important;
}

/* ETICHETTA NUMERO DIAGRAMMA IN ALTO A SINISTRA */
.diagram-number-badge {
  position: absolute;
  top: calc(var(--diagram-size) * 1.07);

  /*left: -70px;  Posizionato a sinistra del numero '8' */

  /* Ancoraggio al bordo sinistro del wrapper della scacchiera */
  right: 100%; 
  /* Distanza fissa dal margine sinistro della scacchiera (regola a piacere) */
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
  /*bottom:34px;*/
  /*left: -22px; */

  /* Ancoraggio a destra per allinearlo visivamente al centro del badge sopra */
  right: 100%;
  margin-right: 10px;
  
  /* Dimensione incrementata per renderlo ben visibile */
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

/* Puoi rimuovere completamente le vecchie regole .delete-btn e .delete-btn:hover inutilizzate */
</style>