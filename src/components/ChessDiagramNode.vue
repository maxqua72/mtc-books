<template>
  <node-view-wrapper class="chess-diagram-container avoid-break">
    <div class="diagram-card" contenteditable="false"
        :style="{ '--diagram-size': currentSize + 'px' }">
      
      <!-- Spostiamo il menu dentro il wrapper per ancorarlo al testo reale -->
      <div class="board-wrapper">
        
        <!-- Action Bar in stile Gmail a comparsa (in alto a destra del bordo scacchiera) -->
        <div class="diagram-actions-menu">
          <!-- Bottone Dimensione Piccola -->
          <button 
            @click="updateLocalSize(32)" 
            :class="{ active: props.node.attrs.size === 32 }"
            title="Dimensione piccola"
            class="action-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
          </button>

          <!-- Bottone Dimensione Media -->
          <button 
            @click="updateLocalSize(40)" 
            :class="{ active: props.node.attrs.size === 40 || (!props.node.attrs.size && store.globalDiagramSize === 40) }"
            title="Dimensione media"
            class="action-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          </button>

          <!-- Bottone Dimensione Grande -->
          <button 
            @click="updateLocalSize(48)" 
            :class="{ active: props.node.attrs.size === 48 }"
            title="Dimensione grande"
            class="action-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/></svg>
          </button>

          <div class="action-divider"></div>

          <!-- Tasto di eliminazione (Icona Cestino) -->
          <button @click="deleteNode" class="action-btn delete-btn-icon" title="Elimina diagramma">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>

        <pre class="chess-pure-text">{{ boardString }}</pre>
      </div>

      <!-- Didascalia del diagramma -->
      <node-view-content class="diagram-caption" placeholder="Diagramma X: ..." />
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { nodeViewProps, NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3'
import { useChessBookStore } from '../stores/chessBookStore'

const store = useChessBookStore()
const props = defineProps(nodeViewProps)

// 1. Calcolo dinamico: priorità alla dimensione locale, altrimenti globale
const currentSize = computed(() => {
  return props.node.attrs.size || store.globalDiagramSize
})

const updateLocalSize = (pixels: number) => {
  // Se clicchi sulla dimensione già attiva che coincide con quella globale, resetta a null
  if (props.node.attrs.size === pixels || (!props.node.attrs.size && store.globalDiagramSize === pixels)) {
    props.updateAttributes({ size: null })
  } else {
    props.updateAttributes({ size: pixels })
  }
}

const resetToGlobal = () => {
  props.updateAttributes({ size: null })
}

const isDarkSquare = (row: number, col: number) => {
  return (row + col) % 2 === 1
}

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
})
</script>

<style scoped>
.chess-diagram-container {
  margin: 2rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.diagram-card {
  position: relative;
  background-color: transparent; /* Rende invisibile lo sfondo del riquadro */
  padding: 0.5rem 0;             /* Mantiene solo un leggero distacco sopra/sotto */
  border: none;                  /* Rimuove il bordo grigio */
  border-radius: 0;              /* Rimuove gli angoli arrotondati */
  box-shadow: none;              /* Rimuove l'ombra */
}

.board-wrapper {
  position: relative; /* Base per il posizionamento del menu */
  display: inline-block; /* Si stringe esattamente attorno alla larghezza del testo della scacchiera */
  margin: 0 auto;
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
  left: -15px; /* Copre lo spazio vuoto a sinistra */
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
  color: #737373;
  margin-top: 0.5rem;
  font-style: italic;
  max-width: 360px;
  outline: none;
}

/* Puoi rimuovere completamente le vecchie regole .delete-btn e .delete-btn:hover inutilizzate */
</style>