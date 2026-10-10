<template>
  <div class="w-[400px] flex flex-col items-center gap-6">
    <!-- Componente Scacchiera Grafica -->
     <p v-if="treeStore.isRecordingMoves && !treeStore.currentTree"
      class="text-xs text-amber-600 text-center">
      Nessuna partita selezionata: le mosse non vengono registrate.
      Clicca un blocco partita nel testo oppure creane uno nuovo.
    </p>
    <ChessboardView ref="chessboardRef" :fen="treeStore.activeFen" :turn-color="currentTurnColor" :dests="playableDests"
      @move="handlePhysicsMove" />

    <!-- Componente Console -->
    <ChessboardConsole :current-fen="treeStore.activeFen" :last-move="lastMoveNotation" @reset="resetBoard"
      @insert-diagram="insertDiagramIntoText" @delete-branch="deleteActiveBranch" @update-fen="handleManualFenUpdate"
      @import-pgn="handlePgnImport" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { Chess } from 'chess.js'
import type { Key } from 'chessground/types'

import ChessboardView from './chessboard/ChessboardView.vue'
import ChessboardConsole from './chessboard/ChessboardConsole.vue'

import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore } from '../stores/chessTreeStore'



const chess = new Chess()
const bookStore = useChessBookStore()
const treeStore = useChessTreeStore()

const lastMoveNotation = ref<string>('Nessuna')

const chessboardRef = ref()

// Inizializza un albero di default se vuoto all'avvio
onMounted(() => {
  chess.load(treeStore.activeFen)

  setTimeout(() => {
    chessboardRef.value?.redraw()
  }, 100)
})

// Calcola il colore del turno basandosi direttamente sullo stato di chess.js sincronizzato
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
// Quando l'utente esegue una mossa fisica sulla scacchiera
const handlePhysicsMove = (orig: Key, dest: Key) => {
  try {
    // 1. Convalida ed esegui la mossa localmente per ricavare la stringa SAN
    const moveData = chess.move({ from: orig, to: dest, promotion: 'q' })
    const newFen = chess.fen()
    lastMoveNotation.value = moveData.san

    // 🔴 CORREZIONE: Se la registrazione live è disattivata, 
    // aggiorna la scacchiera locale ma NON salvare la mossa nell'albero di Pinia
    // Se non c’è un albero attivo, la scacchiera funziona in modalità libera (aggiorna solo la posizione)
    const canRecord = treeStore.isRecordingMoves && !!treeStore.currentTree
    if (!canRecord) {
      treeStore.activeFen = newFen
      return
    }

    // 2. Registra la mossa nell'albero dello store dedicato
    // L'azione addMove genererà internamente il lastRecordedMoveSignal corretto
    const result = treeStore.addMove(moveData.san, newFen)
    if (!result) {
      chess.load(treeStore.activeFen)     // riallinea chess.js allo store
      chessboardRef.value?.resync()       // riporta il pezzo dov'era
    }

  } catch (error) {
    console.warn("[BoardController] Mossa illegale tentata su chess.js:", error)
    // Riallinea chess.js allo store e riporta il pezzo sulla scacchiera dov'era
    chess.load(treeStore.activeFen)
    chessboardRef.value?.resync()
  }
}

// Forza chess.js a seguire i cambi FEN pilotati dall'editor o dall'albero delle varianti
/*watch(() => treeStore.activeFen, (newFen) => {
  if (chess.fen() !== newFen) {
    chess.load(newFen)
    lastMoveNotation.value = chess.history().length > 0 ? chess.history()[chess.history().length - 1] : 'Nessuna'
  }
})*/
watch(() => treeStore.activeFen, (newFen) => {
  if (chess.fen() !== newFen) {
    try {
      chess.load(newFen)
      lastMoveNotation.value = chess.history().length > 0
        ? chess.history()[chess.history().length - 1]
        : 'Nessuna'
    } catch (e) {
      console.error("[BoardController] Errore nel caricamento del FEN dello store:", e)
    }
  }
}, { immediate: true })

// riallinea la scacchiera quando riattivi la registrazione, altrimenti la posizione 
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

// Nuova gestione pulita dedicata all'importazione del PGN
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