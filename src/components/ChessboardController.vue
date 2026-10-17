<template>
  <div class="w-[400px] flex flex-col items-center gap-6"
    @mouseenter="isPointerOver = true" @mouseleave="isPointerOver = false">

    <!-- Scacchiera con i comandi di navigazione subito sotto -->
    <div class="flex flex-col items-center gap-3">
      <ChessboardView ref="chessboardRef" :fen="treeStore.activeFen" :turn-color="currentTurnColor"
        :dests="playableDests" :linked="!!treeStore.currentTree" @move="handlePhysicsMove" />
      <ChessboardNavigation />
    </div>

    <ChessboardConsole :current-fen="treeStore.activeFen" :last-move="lastMoveNotation" @reset="resetBoard"
      @insert-diagram="insertDiagramIntoText" @delete-branch="deleteActiveBranch" @update-fen="handleManualFenUpdate"
      @new-tree="newTreeHere" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Chess } from 'chess.js'
import type { Key } from 'chessground/types'

import ChessboardView from './chessboard/ChessboardView.vue'
import ChessboardConsole from './chessboard/ChessboardConsole.vue'
import ChessboardNavigation from './chessboard/ChessboardNavigation.vue'

import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore, type ChessMoveNode } from '../stores/chessTreeStore'
import { usePgnImportStore } from '../stores/pgnImportStore'

const chess = new Chess()
const bookStore = useChessBookStore()
const treeStore = useChessTreeStore()
const pgnStore = usePgnImportStore()

const lastMoveNotation = ref<string>('Nessuna')
const chessboardRef = ref()

const formatNodeLabel = (node: ChessMoveNode) =>
  `${node.moveNumber}${node.color === 'w' ? '.' : '...'} ${node.san}`

// ---------------------------------------------------------------------------
// Tastiera: navigazione nell'albero (attiva solo con il mouse sopra scacchiera/console)
// Senza albero né cronologia temporanea le azioni dello store non hanno effetto.
// ---------------------------------------------------------------------------
const isPointerOver = ref(false)

const onKeydown = (e: KeyboardEvent) => {
  if (!isPointerOver.value || e.ctrlKey || e.metaKey || e.altKey) return

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
  if (treeStore.workingTree) e.preventDefault()   // senza nulla da navigare lo scroll resta libero
}

onMounted(() => {
  chess.load(treeStore.activeFen)
  window.addEventListener('keydown', onKeydown)
  setTimeout(() => chessboardRef.value?.redraw(), 100)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

const currentTurnColor = computed(() => {
  const tokens = (treeStore.activeFen || '').split(' ')
  if (tokens.length > 1) return tokens[1] === 'w' ? 'white' : 'black'
  return chess.turn() === 'w' ? 'white' : 'black'
})

// Mosse legali per Chessground, ancorate alla reattività del FEN dello store
const playableDests = computed(() => {
  const currentFen = treeStore.activeFen
  if (currentFen && chess.fen() !== currentFen) {
    try {
      chess.load(currentFen)
    } catch (e) {
      console.error('[BoardController] Errore sincronizzazione FEN:', e)
    }
  }

  const dests = new Map<Key, Key[]>()
  chess.moves({ verbose: true }).forEach(m => {
    if (!dests.has(m.from as Key)) dests.set(m.from as Key, [])
    dests.get(m.from as Key)!.push(m.to as Key)
  })
  return dests
})

// Mossa fisica dell'utente:
// - modalità albero: registrata nell'albero (o navigazione al nodo esistente se la mossa c'è già)
// - modalità libera: registrata nella cronologia temporanea, che non viene mai salvata
const handlePhysicsMove = (orig: Key, dest: Key) => {
  try {
    const moveData = chess.move({ from: orig, to: dest, promotion: 'q' })

    const result = treeStore.addMove(moveData.san)
    if (!result) {
      chess.load(treeStore.activeFen)
      chessboardRef.value?.resync()
      return
    }
    lastMoveNotation.value = formatNodeLabel(result.node)
  } catch (error) {
    console.warn('[BoardController] Mossa illegale tentata su chess.js:', error)
    chess.load(treeStore.activeFen)
    chessboardRef.value?.resync()
  }
}

// chess.js segue i cambi di FEN dovuti a navigazione, clic sulle mosse o reset
watch(() => treeStore.activeFen, (newFen) => {
  if (chess.fen() !== newFen) {
    try {
      chess.load(newFen)
      lastMoveNotation.value = treeStore.currentNode
        ? formatNodeLabel(treeStore.currentNode)
        : 'Nessuna'
    } catch (e) {
      console.error('[BoardController] Errore nel caricamento del FEN dello store:', e)
    }
  }
}, { immediate: true })

const resetBoard = () => {
  treeStore.resetPosition()
  lastMoveNotation.value = 'Nessuna'
}

// Diagramma statico nell'editor: la posizione è sempre treeStore.activeFen
const insertDiagramIntoText = () => {
  bookStore.updateActiveFen(treeStore.activeFen)
  bookStore.triggerInsertDiagram()
}

const deleteActiveBranch = () => {
  if (treeStore.activeNodeId) treeStore.deleteBranch(treeStore.activeNodeId)
}

// FEN incollato: posizione libera, oppure posizione iniziale di un albero vuoto
const handleManualFenUpdate = (newFen: string) => {
  const result = treeStore.setBoardFen(newFen)
  if (result === 'invalid') {
    alert('Il FEN inserito non è valido. Verifica la stringa e riprova.')
  } else if (result === 'locked') {
    alert('La posizione iniziale di questo albero è già fissata: per partire da un’altra posizione crea un nuovo albero.')
  } else {
    lastMoveNotation.value = 'Nessuna'
  }
}

// Nuovo albero che parte dalla posizione corrente (anche da una mossa di un altro albero)
const newTreeHere = () => {
  const tree = treeStore.buildTree(`Albero #${treeStore.trees.length + 1}`)
  pgnStore.addTrees([tree], pgnStore.canPlace('after-active') ? 'after-active' : 'cursor')
}
</script>
