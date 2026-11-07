<template>
  <div class="w-[400px] flex flex-col items-center gap-3" @mouseenter="isPointerOver = true"
    @mouseleave="isPointerOver = false">

    <!-- Scacchiera con i comandi di navigazione subito sotto -->
    <div data-tour="board" class="flex flex-col items-center gap-3">
      <div class="relative">
        <ChessboardView ref="chessboardRef" :fen="treeStore.activeFen" :turn-color="currentTurnColor"
          :dests="playableDests" :linked="!!treeStore.currentTree"
          :orientation="treeStore.boardFlipped ? 'black' : 'white'" 
          :shapes="nodeShapes" 
          :auto-shapes="treeStore.autoShapes"
          :editable="editing" :tool="editorTool"
          @move="handlePhysicsMove"
          @shapes="onShapes" @board-change="editorPlacement = $event" />
        <!-- Accanto alla scacchiera, nel margine della colonna: non cambia la larghezza -->
        <component :is="EngineEvalBar" v-if="EngineEvalBar && !editing" />
        <PromotionPicker v-if="pendingPromotion" :color="pendingPromotion.color" @choose="completePromotion"
          @cancel="cancelPromotion" />
      </div>
      <ChessboardNavigation v-show="!editing" />
    </div>

    <BoardEditorPanel v-if="editing" :start-fen="treeStore.activeFen" :placement="editorPlacement"
      :has-tree="!!treeStore.currentTree" v-model:tool="editorTool"
      @set-placement="chessboardRef?.setPlacement($event)"
      @drag-piece="(piece, event) => chessboardRef?.dragNewPiece(piece, event)"
      @flip="treeStore.toggleBoardFlip()" @apply="applyEditor" @cancel="editing = false" />

    <!-- v-show: il pannello del motore resta montato e l'analisi non si interrompe -->
    <ChessboardConsole v-show="!editing" @open-editor="openEditor" :current-fen="treeStore.activeFen" :last-move="lastMoveNotation" @reset="resetBoard"
      @insert-diagram="insertDiagramIntoText" @delete-branch="deleteActiveBranch" @update-fen="handleManualFenUpdate"
      @new-tree="newTreeHere" @clear-shapes="clearShapes" @promote-variation="promoteVariation"
      @make-main-line="makeMainLine" @demote-variation="demoteVariation" />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Chess } from 'chess.js'
import type { Key } from 'chessground/types'

import ChessboardView from './chessboard/ChessboardView.vue'
import ChessboardConsole from './chessboard/ChessboardConsole.vue'
import ChessboardNavigation from './chessboard/ChessboardNavigation.vue'
import PromotionPicker from './chessboard/PromotionPicker.vue'
import BoardEditorPanel from './chessboard/BoardEditorPanel.vue'

import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore, type ChessMoveNode } from '../stores/chessTreeStore'
import { usePgnImportStore } from '../stores/pgnImportStore'
import type { BoardShape } from '../utils/shapes'
import type { EditorTool } from '../utils/boardEditor'
import { capabilities } from '../platform'

// La barra usa lo store del motore: come il pannello, esiste e si scarica solo nel desktop
const EngineEvalBar = capabilities.engine ? defineAsyncComponent(() => import('./chessboard/EngineEvalBar.vue')) : null

const chess = new Chess()
const bookStore = useChessBookStore()
const treeStore = useChessTreeStore()
const pgnStore = usePgnImportStore()

const lastMoveNotation = ref<string>('Nessuna')
const chessboardRef = ref()

const formatNodeLabel = (node: ChessMoveNode) =>
  `${node.moveNumber}${node.color === 'w' ? '.' : '...'} ${node.san}`

// ---------------------------------------------------------------------------
// Tastiera: navigazione nell'albero (con un albero attivo, oppure con il mouse sopra scacchiera/console)
// Senza albero né cronologia temporanea le azioni dello store non hanno effetto.
// ---------------------------------------------------------------------------
const isPointerOver = ref(false)

const onKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return

  const target = e.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return

  // Editor scacchiera: frecce e pezzi di promozione non hanno effetto
  if (editing.value) {
    if (e.key === 'Escape') editing.value = false
    return
  }

  // Scelta del pezzo di promozione: ha la precedenza sulla navigazione e vale anche col mouse fuori
  if (pendingPromotion.value) {
    const k = e.key.toLowerCase()
    if (e.key === 'Escape') cancelPromotion()
    else if (k.length === 1 && 'qrbn'.includes(k)) completePromotion(k as PromotionPiece)
    else return
    e.preventDefault()
    return
  }

  // Con un albero del documento attivo basta la tastiera: dopo il clic su una mossa il fuoco non è su nessun elemento.
  // Il cursore nel testo non arriva qui (controllo sopra) e un clic nel testo disattiva l'albero
  if (!isPointerOver.value && !treeStore.currentTree) return

  if (!treeStore.navigateByKey(e.key)) return
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

type PromotionPiece = 'q' | 'r' | 'b' | 'n'

// Mossa di promozione in attesa della scelta del pezzo (la scacchiera mostra già il pedone sulla casella di arrivo)
const pendingPromotion = ref<{ orig: Key; dest: Key; color: 'white' | 'black' } | null>(null)

const isPromotionMove = (orig: Key, dest: Key) =>
  chess.moves({ verbose: true }).some(m => m.from === orig && m.to === dest && !!m.promotion)

// Mossa fisica dell'utente: una promozione apre prima la scelta del pezzo
const handlePhysicsMove = (orig: Key, dest: Key) => {
  if (isPromotionMove(orig, dest)) {
    pendingPromotion.value = { orig, dest, color: currentTurnColor.value }
    return
  }
  playMove(orig, dest)
}

const completePromotion = (piece: PromotionPiece) => {
  const p = pendingPromotion.value
  if (!p) return
  pendingPromotion.value = null
  playMove(p.orig, p.dest, piece)
}

const cancelPromotion = () => {
  if (!pendingPromotion.value) return
  pendingPromotion.value = null
  chessboardRef.value?.resync()   // il pedone torna dov'era
}

// Registra la mossa:
// - modalità albero: registrata nell'albero (o navigazione al nodo esistente se la mossa c'è già)
// - modalità libera: registrata nella cronologia temporanea, che non viene mai salvata
const playMove = (orig: Key, dest: Key, promotion?: PromotionPiece) => {
  try {
    const moveData = chess.move({ from: orig, to: dest, promotion })

    // Sola lettura: nell'albero del documento si può solo seguire una mossa già presente
    if (bookStore.isLocked && treeStore.currentTree && !treeStore.findChildBySan(moveData.san)) {
      chess.load(treeStore.activeFen)
      chessboardRef.value?.resync()
      return
    }

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
  pendingPromotion.value = null   // la posizione è cambiata: la promozione in sospeso non vale più
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

// Frecce e marcatori: si salvano sulla mossa attiva (in modalità libera sono temporanei come la cronologia).
// L'array vuoto è una costante, così la scacchiera non vede un "cambiamento" a ogni ricalcolo.
const NO_SHAPES: BoardShape[] = []
const nodeShapes = computed(() => treeStore.currentNode?.shapes ?? NO_SHAPES)
const onShapes = (shapes: BoardShape[]) => {
  if (bookStore.isLocked && treeStore.currentTree) return   // sola lettura: le frecce restano solo visive
  treeStore.setNodeShapes(shapes)
}
const clearShapes = () => {
  if (!(bookStore.isLocked && treeStore.currentTree)) treeStore.setNodeShapes([])
  chessboardRef.value?.clearShapes()
}

// Diagramma statico nell'editor: la posizione è sempre treeStore.activeFen
const insertDiagramIntoText = () => {
  if (bookStore.isLocked) return
  bookStore.updateActiveFen(treeStore.activeFen)
  bookStore.updateActiveShapes(chessboardRef.value?.getShapes() ?? [])
  bookStore.triggerInsertDiagram()
}

const deleteActiveBranch = () => {
  if (treeStore.activeNodeId && !bookStore.isLocked) treeStore.deleteBranch(treeStore.activeNodeId)
}

// Riordino delle varianti: la selezione non cambia (gli id dei nodi restano gli stessi).
// Un albero diviso in blocchi viene rifiutato dallo store (la console disabilita già i pulsanti).
const promoteVariation = () => { if (!bookStore.isLocked) treeStore.promoteVariation() }
const makeMainLine = () => { if (!bookStore.isLocked) treeStore.makeMainLine() }
const demoteVariation = () => { if (!bookStore.isLocked) treeStore.demoteVariation() }

// FEN incollato: posizione libera, oppure posizione iniziale di un albero vuoto
const handleManualFenUpdate = (newFen: string) => {
  if (bookStore.isLocked && treeStore.currentTree) return   // sola lettura: la posizione iniziale dell'albero non si cambia
  const result = treeStore.setBoardFen(newFen)
  if (result === 'invalid') {
    alert('Il FEN inserito non è valido. Verifica la stringa e riprova.')
  } else if (result === 'locked') {
    alert('La posizione iniziale di questo albero è già fissata: per partire da un’altra posizione crea un nuovo albero.')
  } else {
    lastMoveNotation.value = 'Nessuna'
  }
}

// --- Editor scacchiera ---
// Stesse condizioni del campo FEN: posizione libera, oppure albero vuoto non in sola lettura
const fenEditable = computed(() => !treeStore.isFenLocked && !(bookStore.isLocked && !!treeStore.currentTree))
const editing = ref(false)
const editorTool = ref<EditorTool>(null)
const editorPlacement = ref('')

const openEditor = () => {
  if (!fenEditable.value) return
  pendingPromotion.value = null
  editorTool.value = null
  editorPlacement.value = treeStore.activeFen.split(' ')[0]
  editing.value = true
}

const applyEditor = (fen: string) => {
  handleManualFenUpdate(fen)
  editing.value = false
}

// La posizione o l'albero cambiano da fuori (clic su una mossa nel testo, sola lettura): l'editor si chiude
watch([() => treeStore.activeFen, () => treeStore.activeTreeId, fenEditable], () => { editing.value = false })

// Nuovo albero che parte dalla posizione corrente (anche da una mossa di un altro albero)
const newTreeHere = () => {
  if (bookStore.isLocked) return
  const tree = treeStore.buildTree(`Albero #${treeStore.trees.length + 1}`)
  pgnStore.addTrees([tree], pgnStore.canPlace('after-active') ? 'after-active' : 'cursor')
}
</script>