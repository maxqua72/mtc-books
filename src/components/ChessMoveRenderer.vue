<template>
  <div class="chess-tree-render-container">
    <template v-if="nodes && nodes.length > 0">
      <slot :node="nodes[0]">
        <!-- 1. Mossa corrente (Marcata come contenteditable="false" per blindarla da Tiptap) -->
        <span ref="moveEl"
          class="chess-move-item" 
          :class="{
            'is-active': isNodeActive(nodes[0].id),
            'is-main-move': !isVariantContext
          }" 
          contenteditable="false"
          @click.stop="selectMove(nodes[0].id)"
          tabindex="0"
          @keydown.stop="handleMoveKeydown(nodes[0].id, $event)"
        >
          <span class="move-prefix">{{ getMovePrefix(nodes[0]) }}</span>
          <!-- <span class="move-san">{{ nodes[0].san }}</span> -->
          <span class="move-san" v-html="convertToChessFont(nodes[0].san)"></span>
        </span>

        <!-- 2. Commento della mossa corrente -->
        <div v-if="nodes[0].comment || isNodeActive(nodes[0].id)" class="move-comment-box"
          :class="isVariantContext ? 'comment-inline' : 'comment-block'" @click.stop="activateThisTree(nodes[0].id)">
          <span 
            :ref="(el) => { if (el) commentRefs[nodes[0].id] = el as HTMLElement }"
            contenteditable="true" 
            class="comment-editable-text" 
            v-once 
            v-html="nodes[0].comment || ''"
            data-placeholder="Inserisci commento..." 
            @blur="onCommentBlur(nodes[0].id, $event)" 
            @keydown.enter="handleEnter"
            @keydown.stop
          ></span>
        </div>

        <!-- 3. VARIANTI ALTERNATIVE -->
        <template v-if="nodes.length > 1">
          <div :class="!isVariantContext ? 'variant-block-break' : 'variant-inline-wrapper'">
            <template v-for="subTree in nodes.slice(1)" :key="subTree.id">
              <span class="bracket"> (</span>
              <ChessMoveRenderer 
                :nodes="[subTree]" 
                :is-variant-context="true" 
                :is-variant-root="true"
                :after-block="false"
                :tree-id="treeId" 
              />
              <span class="bracket">)</span>
            </template>
          </div>
        </template>

        <!-- 4. RISPOSTA CONSECUTIVA -->
        <ChessMoveRenderer 
          v-if="nodes[0].children && nodes[0].children.length > 0" 
          :nodes="nodes[0].children"
          :is-variant-context="isVariantContext" 
          :is-variant-root="false"
          :after-block="!!(nodes[0].comment || nodes.length > 1)"
          :tree-id="treeId" 
        />
      </slot>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useChessTreeStore } from '../stores/chessTreeStore'
import type { ChessMoveNode } from '../stores/chessTreeStore'
import { computed, reactive, ref, watch, nextTick } from 'vue'

interface Props {
  nodes: ChessMoveNode[]
  isVariantContext?: boolean
  isVariantRoot?: boolean
  afterBlock?: boolean
  treeId: string
  figurineType?: string // Deve essere presente qui come opzionale con il "?"
}

const props = withDefaults(defineProps<Props>(), {
  isVariantContext: false,
  isVariantRoot: false,
  afterBlock: false,
  figurineType: 'goodcompanions' // Il valore di default ora combacia perfettamente
})

const treeStore = useChessTreeStore()
const commentRefs = reactive<Record<string, HTMLElement>>({})

const myTree = computed(() => {
  return treeStore.trees.find(t => t.id === props.treeId)
})

const isNodeActive = (nodeId: string) => {
  return treeStore.activeTreeId === props.treeId && treeStore.activeNodeId === nodeId
}

const moveEl = ref<HTMLElement | null>(null)

// Quando questa mossa diventa quella attiva (dalla console, dai tasti o dalla scacchiera)
// la portiamo in vista; con 'nearest' non scorre se è già visibile
watch(
  () => !!props.nodes[0] && isNodeActive(props.nodes[0].id),
  (active) => {
    if (!active) return
    nextTick(() => moveEl.value?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }))
  }
)

const selectMove = (nodeId: string) => {
  // Deseleziona visivamente la NodeView di Tiptap rimuovendo le selezioni globali dell'editor
  // che causerebbero la sovrascrittura del blocco intero
  const selection = window.getSelection()
  if (selection) {
    selection.removeAllRanges()
  }

  if (treeStore.activeTreeId !== props.treeId) {
    treeStore.activeTreeId = props.treeId
  }
  treeStore.setActiveNode(nodeId)
}

const activateThisTree = (nodeId: string) => {
  if (treeStore.activeTreeId !== props.treeId) {
    treeStore.activeTreeId = props.treeId
  }
  if (treeStore.activeNodeId !== nodeId) {
    treeStore.setActiveNode(nodeId)
  }
}

// Gestione blindata della tastiera
const handleMoveKeydown = (nodeId: string, event: KeyboardEvent) => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.key === 'Tab' || event.key.startsWith('Arrow')) {
    return
  }

  // Blocca la propagazione e l'azione di Prosemirror
  event.preventDefault()
  event.stopPropagation()

  const commentEl = commentRefs[nodeId]
  if (commentEl) {
    commentEl.focus()

    if (event.key.length === 1) {
      if (commentEl.innerText.trim() === '') {
        commentEl.innerHTML = ''
      }

      const textNode = document.createTextNode(event.key)
      commentEl.appendChild(textNode)

      const range = document.createRange()
      const sel = window.getSelection()
      if (sel) {
        range.setStartAfter(textNode)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }
}

const onCommentBlur = (nodeId: string, event: FocusEvent) => {
  const target = event.target as HTMLElement
  const currentHtml = target.innerHTML

  const targetNode = treeStore.findNodeById(myTree.value?.rootNodes || [], nodeId)
  if (targetNode) {
    if (currentHtml === '' || currentHtml === '<br>' || target.innerText.trim() === '') {
      targetNode.comment = null
    } else {
      targetNode.comment = currentHtml
    }
  }
}

const handleEnter = (event: KeyboardEvent) => {
  event.preventDefault()
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return

  const range = selection.getRangeAt(0)
  const textNode = document.createTextNode("\n")
  range.deleteContents()
  range.insertNode(textNode)
  range.setStartAfter(textNode)
  range.setEndAfter(textNode)
  selection.removeAllRanges()
  selection.addRange(range)
}

const getMovePrefix = (node: ChessMoveNode): string => {
  if (node.color === 'w') {
    return `${node.moveNumber}. `
  }

  const parentNode = treeStore.findNodeById(myTree.value?.rootNodes || [], node.parentId || '')
  if (!parentNode) {
    return `${node.moveNumber}... `
  }

  if (props.isVariantRoot) {
    return `${node.moveNumber}... `
  }

  if (props.afterBlock && (!props.isVariantContext || node.children?.length === 0)) {
    return `${node.moveNumber}... `
  }

  return ''
}




const convertToMerida = (san: string): string => {
  if (!san) return ''
  
  // Mappa dei pezzi sul font Merida (adatta i caratteri se la tua versione differisce)
  const meridaMap: Record<string, string> = {
    'N': 't', // Cavallo
    'B': 'l', // Alfiere
    'R': 'r', // Torre
    'Q': 'd', // Donna
    'K': 'k'  // Re
  }

  const firstChar = san.charAt(0)
  if (meridaMap[firstChar]) {
    // Sostituiamo la lettera del pezzo e lasciamo il resto della mossa invariato
    return `<span class="figurine-font">${meridaMap[firstChar]}</span>${san.slice(1)}`
  }
  
  return san
}

const convertToChessCases = (san: string): string => {
 if (!san) return ''
  
  // Mappa le maiuscole del SAN nelle minuscole pulite del font
  const ccMap: Record<string, string> = {
    'K': 'k', // Re trasparente
    'Q': 'q', // Donna trasparente
    'R': 'r', // Torre trasparente
    'B': 'b', // Alfiere trasparente
    'N': 'n'  // Cavallo trasparente
  }

  const firstChar = san.charAt(0)
  if (ccMap[firstChar]) {
    return `<span class="chess-cases-figurine">${ccMap[firstChar]}</span>${san.slice(1)}`
  }
  
  return san
}

const convertToGoodCompanions = (san: string): string => {
  if (!san) return ''
  
  // Mappa le maiuscole del SAN nelle minuscole pulite del font
  const tgcMap: Record<string, string> = {
    'K': '0', // Re trasparente
    'Q': 'G', // Donna trasparente
    'R': 'W', // Torre trasparente
    'B': 'm', // Alfiere trasparente
    'N': '©'  // Cavallo trasparente
  }

  const firstChar = san.charAt(0)
  if (tgcMap[firstChar]) {
    return `<span class="tgc-figurine">${tgcMap[firstChar]}</span>${san.slice(1)}`
  }
  
  return san
}

const convertToChessFont = (san: string): string => {
  if(props.figurineType === 'cases') {
    return convertToChessCases(san)
  } else if (props.figurineType === 'goodcompanions') {
    return convertToGoodCompanions(san)
  } else {
    return san
  }
}
</script>

<style scoped>
.chess-tree-render-container {
  display: contents;
}

.chess-move-item {
  padding: 0 2px;
  cursor: pointer;
  display: inline;
  outline: none;
  /* Mantiene il testo non selezionabile dall'editor di testo standard */
  user-select: none;
}

.chess-move-item.is-main-move {
  font-weight: bold;
  color: #111827;
}

.chess-move-item.is-active {
  background: #3b82f6;
  color: #fff !important;
  border-radius: 2px;
}

.move-comment-box {
  color: #374151;
  display: inline;
}

.comment-block,
.variant-block-break {
  display: block;
  margin: 0.2rem 0 0.2rem 0rem;
  font-family: Lora, Georgia, Cambria, serif;
  line-height: 1.4;
}

.comment-block {
  /* font-style: italic; */
  text-indent: 0;
}

.comment-inline,
.variant-inline-wrapper {
  display: inline;
  /* font-style: italic; */
  padding: 0 4px;
}

.comment-editable-text {
  display: inline;
  outline: none;
  min-width: 15px;
  border-bottom: 1px dashed #cbd5e1;
  white-space: pre-wrap;
}

.comment-editable-text:focus {
  border-bottom-color: #3b82f6;
  background: #f8fafc;
}

.comment-editable-text:empty::before {
  content: attr(data-placeholder);
  color: #94a3b8;
  font-style: italic;
}

.bracket {
  font-weight: normal;
  color: #111827;
}

:deep(.figurine-font) {
  font-family: 'Chess Cases', sans-serif; /* Usa il nome esatto con cui è registrato il tuo font */
  font-size: 1.2em; /* Regola la dimensione per allinearla bene al testo delle coordinate */
  line-height: 1;
  margin-right: 1px;
}

:deep(.chess-cases-figurine) {
  font-family: 'Chess Cases', sans-serif;
  font-size: 1.15em;
  line-height: 1;
  margin-right: 0px;
  vertical-align: -3px;
}

/* Stile per The Good Companions (richiede più compensazione geometrica) */
:deep(.tgc-figurine) {
  font-family: 'Chess The Good Companions', sans-serif;
  font-size: 1.05em; /* Leggermente più piccolo per uniformarlo alle lettere */
  line-height: 1;
  margin-right: 1px;
  vertical-align: 1px; /* Lo spinge più in basso perché i glifi da diagramma tendono a "volare" */
}


</style>