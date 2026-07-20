<template>
  <div class="w-full flex flex-col items-center gap-6">
    <!-- Componente Scacchiera Grafica -->
    <ChessboardView :fen="treeStore.activeFen" :turn-color="currentTurnColor" :dests="playableDests"
      @move="handlePhysicsMove" />

    <!-- Componente Console -->
    <ChessboardConsole 
      :current-fen="treeStore.activeFen" 
      :last-move="lastMoveNotation" 
      @reset="resetBoard"
      @insert-diagram="insertDiagramIntoText" 
      @delete-branch="deleteActiveBranch" 
      @update-fen="handleManualFenUpdate"
      @import-pgn="handlePgnImport"
    />
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

// Inizializza un albero di default se vuoto all'avvio
onMounted(() => {
  if (treeStore.trees.length === 0) {
    treeStore.createNewTree('Capitolo 1: Analisi')
  } else {
    chess.load(treeStore.activeFen)
  }
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
    if (!treeStore.isRecordingMoves) {
      // Sincronizza il FEN attivo temporaneo dello store per mostrare la mossa sulla scacchiera,
      // ma senza aggiungere un nodo reale all'albero delle mosse.
      treeStore.activeFen = newFen
      return
    }

    // 2. Registra la mossa nell'albero dello store dedicato
    // L'azione addMove genererà internamente il lastRecordedMoveSignal corretto
    treeStore.addMove(moveData.san, newFen)

  } catch (error) {
    console.warn("[BoardController] Mossa illegale tentata su chess.js:", error)
    // Ripristina la posizione grafica precedente in caso di mossa illegale
    treeStore.setActiveNode(treeStore.activeNodeId)
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