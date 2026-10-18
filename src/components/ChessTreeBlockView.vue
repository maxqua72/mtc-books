<template>
  <node-view-wrapper class="chess-tree-block-container" :class="{ 'is-active-tree': isActive,  'is-pgn-target': !!pgnBadge }" @mousedown="onMouseDown"
    @click="activateTree">
    <div v-if="pgnBadge" class="pgn-target-badge" contenteditable="false">{{ pgnBadge }}</div>
    <!-- Header comandi stile Gmail: compare in posizione assoluta solo all'hover del blocco -->
    <div class="block-header">
      <span class="game-title">📊 {{ currentTree?.title || 'Albero di mosse' }}</span>
      <button v-if="!locked" @click.stop="insertParagraph('before')" class="action-btn" title="Inserisci un paragrafo sopra">¶↑</button>
      <button v-if="!locked" @click.stop="insertParagraph('after')" class="action-btn" title="Inserisci un paragrafo sotto">¶↓</button>
      <button v-if="currentTree" @click.stop="copyBlock" class="action-btn"
        :title="copied ? 'Copiato' : 'Copia l\'albero (poi Ctrl+V o «Incolla albero»)'">
        <i :class="['fa-solid', copied ? 'fa-check' : 'fa-copy']"></i>
      </button>
      <button v-if="currentTree && !locked" @click.stop="cutBlock" class="action-btn"
        title="Taglia l'albero (poi Ctrl+V o «Incolla albero»)">
        <i class="fa-solid fa-scissors"></i>
      </button>
      <button v-if="!locked" @click.stop="deleteBlock" class="delete-btn" title="Elimina il blocco albero">
        ✕
      </button>
    </div>

    <div v-if="headerView" class="tree-pgn-header" contenteditable="false">
      <div v-if="headerView.players || headerView.result" class="tph-main">
        <span class="tph-players">{{ headerView.players }}</span>
        <span v-if="headerView.result" class="tph-result">{{ headerView.result }}</span>
      </div>
      <div v-if="headerView.event" class="tph-event">{{ headerView.event }}</div>
      <div v-if="headerView.opening" class="tph-opening">{{ headerView.opening }}</div>
    </div>

    <div class="block-content">
      <!-- Blocco senza albero nello store: non attivabile, nessun albero vuoto creato di nascosto -->
      <div v-if="!currentTree" class="empty-tree-placeholder is-orphan">
        Albero non trovato. Elimina questo blocco oppure prova ad annullare l'ultima operazione.
      </div>

      <!-- Albero vuoto: placeholder -->
      <div v-else-if="currentTree.rootNodes.length === 0" class="empty-tree-placeholder">
        Muovi i pezzi sulla scacchiera per iniziare a registrare le mosse in questo albero...
      </div>

      <!-- Altrimenti avvia il ciclo ricorsivo di notazione -->
      <ChessMoveRenderer v-else :nodes="currentTree.rootNodes" :tree-id="props.node.attrs.treeId" />
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'
import { computed, ref } from 'vue'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { usePgnImportStore } from '../stores/pgnImportStore'
import { useChessBookStore } from '../stores/chessBookStore'
import ChessMoveRenderer from './ChessMoveRenderer.vue'
import { getHeaderView } from '../utils/pgnHeader'
import { writeTreeClipMarker } from '../utils/treeClipboard'

defineOptions({
  name: 'ChessTreeBlockView'
})

const props = defineProps(nodeViewProps)
const treeStore = useChessTreeStore()
const pgnStore = usePgnImportStore()
const bookStore = useChessBookStore()
const locked = computed(() => bookStore.isLocked)   // sola lettura: restano visibili solo titolo e copia

const pgnBadge = computed(() => {
  const badge = pgnStore.targetBadge
  return badge && badge.treeId === props.node.attrs.treeId ? badge.text : null
})

const currentTree = computed(() => {
  return treeStore.trees.find(t => t.id === props.node.attrs.treeId)
})

// Il click riattiva sempre l'albero e riallinea la scacchiera, anche se era già quello attivo
const activateTree = () => {
  const id = props.node.attrs.treeId
  if (!id || !currentTree.value) return
  treeStore.activateTree(id)
}

const isActive = computed(() => treeStore.activeTreeId === props.node.attrs.treeId)

// Intestazione ricavata dai tag PGN (solo se l'albero la ha e l'interruttore è acceso)
const headerView = computed(() => {
  const tree = currentTree.value
  return tree?.showHeader ? getHeaderView(tree.header) : null
})

const onMouseDown = (event: MouseEvent) => {
  const wrapper = event.currentTarget as HTMLElement
  const target = event.target as HTMLElement

  // Commenti editabili, input e bottoni mantengono il comportamento nativo.
  // Il controllo "wrapper.contains" serve perché .ProseMirror è a sua volta contenteditable
  const editable = target.closest(
    '[contenteditable]:not([contenteditable="false"]), input, textarea, button'
  )
  if (editable && editable !== wrapper && wrapper.contains(editable)) return

  event.preventDefault()          // il browser non sposta il cursore nel paragrafo vicino
  props.editor.commands.blur()    // niente focus nel testo: nessun paragrafo evidenziato
}

// Paragrafo sopra/sotto il blocco: i blocchi non si possono "attraversare" col cursore, serve un comando esplicito
const insertParagraph = (where: 'before' | 'after') => {
  const pos = props.getPos()
  if (typeof pos !== 'number') return
  const at = where === 'before' ? pos : pos + props.node.nodeSize
  props.editor.chain().insertContentAt(at, { type: 'paragraph' }).setTextSelection(at + 1).focus().run()
}

// Copia: istantanea dell'albero negli appunti interni; il blocco resta dov'è
const copied = ref(false)
const copyBlock = () => {
  const id = props.node.attrs.treeId
  if (!id || !treeStore.copyTree(id, 'copy')) return
  void writeTreeClipMarker()
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

// Taglia: istantanea + rimozione del blocco. L'albero resta nello store (come per l'eliminazione),
// quindi Ctrl+Z ripristina il blocco con i suoi dati.
const cutBlock = () => {
  const id = props.node.attrs.treeId
  if (!id || !treeStore.copyTree(id, 'cut')) return
  void writeTreeClipMarker()
  props.deleteNode()
}

// L'albero resta nello store (diventa orfano e viene ripulito al salvataggio): così Ctrl+Z ripristina anche i dati
const deleteBlock = () => {
  if (confirm("Vuoi rimuovere questo albero di mosse e tutta la sua notazione dal documento?")) {
    props.deleteNode()
  }
}
</script>

<style scoped>
.chess-tree-block-container {
    /* Padding (6px) e bordo (1px) stanno dentro il riquadro: li sottraiamo
     perché lo spazio visibile coincida con quello del PDF, dove non ci sono */
  margin-top: max(0px, calc(var(--variation-spacing, 4mm) - 7px));
  margin-bottom: max(0px, calc(var(--variation-spacing, 4mm) - 7px));
  display: block;
  position: relative;

  /* L'effetto allargamento: aggiungiamo spazio interno ma lo compensiamo 
     portando il riquadro all'esterno con i margini negativi */
  padding: 6px;
  margin-left: -7px;
  /* Sposta il riquadro a sinistra (-6px padding - 1px bordo) */
  margin-right: -7px;
  /* Sposta il riquadro a destra */

  border: 1px solid transparent;
  border-radius: 6px;
  transition: background-color 0.2s, border-color 0.2s;
}

/* Quando il mouse passa sopra il blocco intero della partita */
.chess-tree-block-container:hover {
  background-color: rgba(248, 250, 252, 0.7);
  border-color: #cbd5e1;
}

/* Header comandi nascosto di base */
.block-header {
  display: none;
  position: absolute;
  top: -14px;
  right: 10px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 2px 8px;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
  z-index: 20;
}

/* Mostra l'header comandi solo all'hover */
.chess-tree-block-container:hover .block-header {
  display: flex;
}

.chess-tree-block-container.is-active-tree {
  background-color: rgba(239, 246, 255, 0.4);
}

/* Stessa linea blu dei paragrafi (-12px), compensando il margin-left: -7px del blocco */
.chess-tree-block-container.is-active-tree::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: #3b82f6;
  border-radius: 2px;
}

.game-title {
  font-size: 0.75rem;
  font-family: ui-sans-serif, system-ui, sans-serif;
  color: #64748b;
  font-weight: 500;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #ef4444;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: ui-sans-serif, system-ui, sans-serif;
  transition: background-color 0.15s;
}

.delete-btn:hover {
  background-color: #fee2e2;
}

.action-btn {
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background-color 0.15s, color 0.15s;
}

.action-btn:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}

.block-content {
  padding: 0;
  line-height: 1.6;
  font-family: Lora, Georgia, Cambria, serif;
}

.empty-tree-placeholder {
  color: #9ca3af;
  font-style: italic;
  font-size: 0.95rem;
  padding: 8px;
  border: 1px dashed #cbd5e1;
  border-radius: 4px;
}

.chess-tree-block-container.is-pgn-target {
  outline: 2px dashed #3b82f6;
  outline-offset: 3px;
  background-color: rgba(59, 130, 246, 0.05);
}

.pgn-target-badge {
  display: inline-block;
  margin: 0 0 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font: 600 11px ui-sans-serif, system-ui, sans-serif;
  user-select: none;
}

.empty-tree-placeholder.is-orphan {
  color: #b91c1c;
  border-color: #fca5a5;
  background-color: #fef2f2;
}

/* Intestazione ricavata dai tag PGN (le stesse classi hanno le regole di stampa in pdf-print.css) */
.tree-pgn-header {
  margin: 0 0 6px;
  padding: 0 0 4px;
  border-bottom: 1px solid #d4d4d4;
  font-family: Lora, Georgia, Cambria, serif;
  user-select: none;
}
.tph-main {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-weight: 700;
  font-size: 11pt;
  color: #171717;
}
.tph-result { white-space: nowrap; }
.tph-event { font-size: 9.5pt; color: #525252; }
.tph-opening { font-size: 9.5pt; font-style: italic; color: #525252; }

/* REGOLA PER LA STAMPA / ESPORTAZIONE PDF:
   Annulla completamente i margini negativi, i padding e nasconde l'interfaccia dell'hover */
@media print {
  .chess-tree-block-container {
    padding: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    border: none !important;
    background-color: transparent !important;
  }

  .chess-tree-block-container::before {
    display: none !important;
  }


  .block-header {
    display: none !important;
  }
}
</style>