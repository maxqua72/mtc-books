<template>
  <div class="w-[400px] flex flex-col items-center gap-6"
    @mouseenter="isPointerOver = true" @mouseleave="isPointerOver = false">
    <p v-if="treeStore.isRecordingMoves && !treeStore.currentTree"
      class="text-xs text-amber-600 text-center">
      Nessuna partita selezionata: le mosse non vengono registrate.
      Clicca un blocco partita nel testo oppure creane uno nuovo.
    </p>

    <!-- Componente Scacchiera Grafica -->
    <!-- Scacchiera con i comandi di navigazione subito sotto -->
    <div class="flex flex-col items-center gap-3">
      <ChessboardView ref="chessboardRef" :fen="treeStore.activeFen" :turn-color="currentTurnColor" :dests="playableDests"
        @move="handlePhysicsMove" />
      <ChessboardNavigation />
    </div>

    <!-- Componente Console -->
    <ChessboardConsole :current-fen="treeStore.activeFen" :last-move="lastMoveNotation" @reset="resetBoard"
      @insert-diagram="insertDiagramIntoText" @delete-branch="deleteActiveBranch" @update-fen="handleManualFenUpdate"
      @import-pgn="handlePgnImport" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Chess } from 'chess.js'
import type { Key } from 'chessground/types'

import ChessboardView from './chessboard/ChessboardView.vue'
import ChessboardConsole from './chessboard/ChessboardConsole.vue'
import ChessboardNavigation from './chessboard/ChessboardNavigation.vue'

import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore, type ChessMoveNode } from '../stores/chessTreeStore'

const chess = new Chess()
const bookStore = useChessBookStore()
const treeStore = useChessTreeStore()

const lastMoveNotation = ref<string>('Nessuna')

const chessboardRef = ref()

const formatNodeLabel = (node: ChessMoveNode) =>
  `${node.moveNumber}${node.color === 'w' ? '.' : '...'} ${node.san}`

// ---------------------------------------------------------------------------
// Tastiera: navigazione nell'albero (attiva solo con il mouse sopra scacchiera/console)
// ---------------------------------------------------------------------------
const isPointerOver = ref(false)

const onKeydown = (e: KeyboardEvent) => {
  if (!isPointerOver.value || e.ctrlKey || e.metaKey || e.altKey) return

  // Non interferire con la scrittura (editor, commenti, campi FEN/PGN)
  const target = e.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return

  switch (e.key) {
    case 'ArrowLeft':  treeStore.goBack(); break
    case 'ArrowRight': treeStore.goForward(); break
    case 'ArrowUp':    treeStore.goToSibling(-1); break
    case 'ArrowDown':  treeStore.goToSibling(1); break
    case 'Home':       treeStore.goToStart(); break
    case 'End':        treeStore.goToEnd(); break
    default: return
  }
  e.preventDefault()
}

// Sincronizza chess.js con lo store all'avvio e registra la tastiera
onMounted(() => {
  chess.load(treeStore.activeFen)
  window.addEventListener('keydown', onKeydown)

  setTimeout(() => {
    chessboardRef.value?.redraw()
  }, 100)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// Calcola il turno basandosi esplicitamente sul FEN attivo dello store
const currentTurnColor = computed(() => {
  // Se non c'è ancora un FEN, default bianco
  if (!treeStore.activeFen) return 'white'

  // Il FEN ha i turni indicati dopo il primo spazio (es: "rnb... w KQkq -")
  const tokens = treeStore.activeFen.split(' ')
  if (tokens.length > 1) {
    return tokens[1] === 'w' ? 'white' : 'black'
  }

  // Fallback sull'istanza chess locale
  return chess.turn() === 'w' ? 'white' : 'black'
})

// Riconfigura le mosse legali per Chessground ancorandole alla reattività del FEN dello store
const playableDests = computed(() => {
  // Forza la dipendenza reattiva sul FEN dello store
  const currentFen = treeStore.activeFen

  // Sincronizziamo al volo l'istanza locale prima del calcolo per evitare lag di watcher
  if (currentFen && chess.fen() !== currentFen) {
    try {
      chess.load(currentFen)
    } catch (e) {
      console.error("[BoardController] Errore sincronizzazione computed FEN:", e)
    }
  }

  const dests = new Map<Key, Key[]>()
  chess.moves({ verbose: true }).forEach(m => {
    if (!dests.has(m.from as Key)) dests.set(m.from as Key, [])
    dests.get(m.from as Key)!.push(m.to as Key)
  })
  return dests
})

// Quando l'utente esegue una mossa fisica sulla scacchiera
const handlePhysicsMove = (orig: Key, dest: Key) => {
  try {
    // 1. Convalida ed esegui la mossa localmente per ricavare la stringa SAN
    const moveData = chess.move({ from: orig, to: dest, promotion: 'q' })
    const newFen = chess.fen()

    // 2. La mossa esiste già tra le prosecuzioni del nodo attivo (linea principale o variante):
    //    si naviga fin lì, anche con la registrazione spenta
    const existing = treeStore.findChildBySan(moveData.san)
    if (existing) {
      treeStore.setActiveNode(existing.id)
      lastMoveNotation.value = formatNodeLabel(existing)
      return
    }

    // 3. Mossa nuova: si registra solo con registrazione accesa e un albero attivo.
    //    Altrimenti la scacchiera funziona in modalità libera (aggiorna solo la posizione)
    const canRecord = treeStore.isRecordingMoves && !!treeStore.currentTree
    if (!canRecord) {
      treeStore.activeFen = newFen
      lastMoveNotation.value = moveData.san
      return
    }

    // 4. Registra la mossa nell'albero dello store dedicato
    const result = treeStore.addMove(moveData.san, newFen)
    if (!result) {
      chess.load(treeStore.activeFen)     // riallinea chess.js allo store
      chessboardRef.value?.resync()       // riporta il pezzo dov'era
      return
    }
    lastMoveNotation.value = formatNodeLabel(result.node)

  } catch (error) {
    console.warn("[BoardController] Mossa illegale tentata su chess.js:", error)
    // Riallinea chess.js allo store e riporta il pezzo sulla scacchiera dov'era
    chess.load(treeStore.activeFen)
    chessboardRef.value?.resync()
  }
}

// chess.js segue i cambi di FEN dovuti a navigazione, clic sulle mosse o reset
watch(() => treeStore.activeFen, (newFen) => {
  if (chess.fen() !== newFen) {
    try {
      chess.load(newFen)
      // Dopo load() la cronologia di chess.js è vuota: l'etichetta si ricava dal nodo attivo
      lastMoveNotation.value = treeStore.currentNode
        ? formatNodeLabel(treeStore.currentNode)
        : 'Nessuna'
    } catch (e) {
      console.error("[BoardController] Errore nel caricamento del FEN dello store:", e)
    }
  }
}, { immediate: true })

// Riallinea la scacchiera quando riattivi la registrazione, altrimenti la posizione
// libera resta e le nuove mosse si agganciano al nodo sbagliato
watch(() => treeStore.isRecordingMoves, (on) => {
  if (on) treeStore.setActiveNode(treeStore.activeNodeId)
})

const resetBoard = () => {
  chess.reset()
  lastMoveNotation.value = 'Nessuna'
  treeStore.setActiveNode(null)
}

// Inserisce il diagramma statico nell'editor (Metodo originale mantenuto)
const insertDiagramIntoText = () => {
  bookStore.updateActiveFen(treeStore.activeFen)
  bookStore.triggerInsertDiagram()
}

// Rimuove la variante selezionata sia dall'albero che dal documento di testo
const deleteActiveBranch = () => {
  if (!treeStore.activeNodeId) return

  // Avvia la cancellazione nell'albero. Lo store emetterà il segnale per il testo.
  treeStore.deleteBranch(treeStore.activeNodeId)
}

const handleManualFenUpdate = (newFen: string) => {
  try {
    // Validiamo il FEN caricandolo temporaneamente nell'istanza chess.js
    chess.load(newFen)

    // Se il FEN è valido, aggiorniamo il FEN attivo nello store di Pinia
    treeStore.activeFen = chess.fen()

    // Aggiorniamo la notazione dell'ultima mossa dato che la catena precedente si interrompe/cambia
    lastMoveNotation.value = 'FEN Incollato'
  } catch (error) {
    console.error("[BoardController] Il FEN inserito non è valido:", error)
    alert("Il FEN inserito non è valido. Verifica la stringa e riprova.")

    // Forza il ripristino del FEN attuale nello store per ripulire l'input grafico errato
    const current = treeStore.activeFen
    treeStore.activeFen = ''
    nextTick(() => {
      treeStore.activeFen = current
    })
  }
}

// Gestione dedicata all'importazione del PGN
const handlePgnImport = (pgnString: string) => {
  try {
    const testChess = new Chess()
    testChess.loadPgn(pgnString)

    if (testChess.history().length === 0) {
      throw new Error("PGN vuoto o privo di mosse leggibili")
    }

    const success = treeStore.importPgn(pgnString)
    if (success) {
      lastMoveNotation.value = 'PGN Importato'
    } else {
      throw new Error("Errore durante l'inserimento sequenziale nell'albero")
    }
  } catch (error) {
    console.error("[BoardController] Impossibile elaborare il PGN:", error)
    alert("Il testo inserito non contiene una catena di mosse PGN valida.")
  }
}
</script>