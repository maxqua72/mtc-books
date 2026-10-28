<template>
  <div class="chess-tree-render-container">
    <template v-if="nodes && nodes.length > 0">
      <slot :node="nodes[0]">
        <!-- 1. Mossa corrente (Marcata come contenteditable="false" per blindarla da Tiptap) -->
        <span class="chess-move-item" :class="{
          'is-active': isNodeActive(nodes[0].id),
          'is-main-move': !isVariantContext
        }" contenteditable="false" @click.stop="selectMove(nodes[0].id)" tabindex="0"
          @keydown.stop="handleMoveKeydown(nodes[0].id, $event)">
          <span class="move-prefix">{{ getMovePrefix(nodes[0]) }}</span>
          <!-- <span class="move-san">{{ nodes[0].san }}</span> -->
          <!-- <span class="move-san" v-html="convertToChessFont(nodes[0].san)"></span> -->
          <!-- <span class="move-san"><span v-if="sanParts(nodes[0].san).glyph" :class="sanParts(nodes[0].san).cls">{{ sanParts(nodes[0].san).glyph }}</span>{{ sanParts(nodes[0].san).rest }}</span> -->
          <span class="move-san"><template v-for="(p, i) in sanParts(nodes[0].san)" :key="i"><span v-if="p.cls"
                :class="p.cls">{{ p.text }}</span><template v-else>{{ p.text }}</template></template></span>
          <span v-if="nagText(nodes[0])" class="move-nag">{{ nagText(nodes[0]) }}</span>
        </span>

        <!-- 2. Commento della mossa corrente -->
        <div v-if="nodes[0].comment || (isNodeActive(nodes[0].id) && !locked)" class="move-comment-box"
          :class="isVariantContext ? 'comment-inline' : 'comment-block'" @click.stop="activateThisTree(nodes[0].id)">
          <span
            :ref="(el) => { if (el) { commentRefs[nodes[0].id] = el as HTMLElement; applyEditable(el as HTMLElement); refreshRefs(el as HTMLElement) } }"
            contenteditable="true" class="comment-editable-text" v-once v-html="safeComment(nodes[0].comment)"
            data-placeholder="Inserisci commento..." @blur="onCommentBlur(nodes[0].id, $event)"
            @keydown.enter="handleEnter" @paste="handlePaste" @keydown.stop @click="onCommentClick"></span>
        </div>

        <!-- 3. VARIANTI ALTERNATIVE -->
        <template v-if="nodes.length > 1">
          <div :class="!isVariantContext ? 'variant-block-break' : 'variant-inline-wrapper'">
            <template v-for="subTree in orderedVariants" :key="subTree.id">
              <span class="bracket"> (</span>
              <ChessMoveRenderer :nodes="[subTree]" :is-variant-context="true" :is-variant-root="true"
                :after-block="false" :tree-id="treeId" :open-ids="openIds" />
              <span v-if="!openIds.has(subTree.id)" class="bracket">)</span>
            </template>
          </div>
        </template>

        <!-- 4. RISPOSTA CONSECUTIVA -->
        <ChessMoveRenderer v-if="nodes[0].children && nodes[0].children.length > 0" :key="nodes[0].children[0].id"
          :nodes="nodes[0].children" :is-variant-context="isVariantContext" :is-variant-root="false"
          :after-block="!!(nodes[0].comment || nodes.length > 1)" :tree-id="treeId" :open-ids="openIds" />

      </slot>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useChessTreeStore } from '../stores/chessTreeStore'
import { useChessBookStore } from '../stores/chessBookStore'
import type { ChessMoveNode } from '../stores/chessTreeStore'
import { computed, reactive, watch } from 'vue'
import { sanitizeCommentHtml } from '../utils/sanitize'
import { nagsToText } from '../utils/nags'
import { refreshDiagramRefs } from '../utils/diagramRefs'
import { requestGoToDiagram } from '../composables/useGoToDiagram'


interface Props {
  nodes: ChessMoveNode[]
  isVariantContext?: boolean
  isVariantRoot?: boolean
  afterBlock?: boolean
  treeId: string
  figurineType?: string // Deve essere presente qui come opzionale con il "?"
  openIds?: ReadonlySet<string>   // radici di variante la cui parentesi chiude non si stampa (il testo continua nel blocco dopo)
}

const props = withDefaults(defineProps<Props>(), {
  isVariantContext: false,
  isVariantRoot: false,
  afterBlock: false,
  figurineType: 'goodcompanions', // Il valore di default ora combacia perfettamente
  openIds: () => new Set<string>(),
})

const treeStore = useChessTreeStore()
const bookStore = useChessBookStore()
const locked = computed(() => bookStore.isLocked)   // sola lettura: commenti non modificabili
const commentRefs = reactive<Record<string, HTMLElement>>({})

// Il commento ha v-once (per non perdere il cursore): l'attributo contenteditable va aggiornato a mano
const applyEditable = (el: HTMLElement) => el.setAttribute('contenteditable', locked.value ? 'false' : 'true')
watch(locked, () => Object.values(commentRefs).forEach(applyEditable))

// Numero e stato dei riferimenti nei commenti: il commento ha v-once, quindi si riallinea a mano
const refreshRefs = (el: HTMLElement) => refreshDiagramRefs(el, bookStore.diagramLabels)
watch(() => bookStore.diagramLabels, () => Object.values(commentRefs).forEach(refreshRefs), { flush: 'post' })

// Ctrl/Cmd+clic su un riferimento: vai al diagramma
const onCommentClick = (event: MouseEvent) => {
  if (!event.ctrlKey && !event.metaKey) return
  const ref = (event.target as HTMLElement).closest<HTMLElement>('span[data-type="diagram-ref"]')
  const id = ref?.getAttribute('data-target-id')
  if (!id) return
  event.preventDefault()
  event.stopPropagation()
  requestGoToDiagram(id)
}


const safeComment = (comment: string | null) => sanitizeCommentHtml(comment)


const myTree = computed(() => {
  return treeStore.trees.find(t => t.id === props.treeId)
})

// Le varianti rimaste aperte vanno per ultime: dopo di loro il blocco finisce
const orderedVariants = computed(() => {
  const rest = props.nodes.slice(1)
  if (props.openIds.size === 0) return rest
  return [...rest.filter(n => !props.openIds.has(n.id)), ...rest.filter(n => props.openIds.has(n.id))]
})

const isNodeActive = (nodeId: string) => {
  return treeStore.activeTreeId === props.treeId && treeStore.activeNodeId === nodeId
}

const selectMove = (nodeId: string) => {
  // Deseleziona visivamente la NodeView di Tiptap rimuovendo le selezioni globali dell'editor
  // che causerebbero la sovrascrittura del blocco intero
  const selection = window.getSelection()
  if (selection) {
    selection.removeAllRanges()
  }

  treeStore.selectNode(props.treeId, nodeId)
}

const activateThisTree = (nodeId: string) => {
  if (treeStore.activeTreeId !== props.treeId || treeStore.activeNodeId !== nodeId) {
    treeStore.selectNode(props.treeId, nodeId)
  }
}

// Gestione blindata della tastiera
const handleMoveKeydown = (nodeId: string, event: KeyboardEvent) => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.key === 'Tab' || event.key.startsWith('Arrow')) {
    return
  }

  // Sola lettura: niente digitazione automatica nel commento
  if (locked.value) return

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
  if (locked.value) return
  const target = event.target as HTMLElement
  const targetNode = treeStore.findNodeById(myTree.value?.rootNodes || [], nodeId)
  if (!targetNode) return

  // Si salva sempre la versione sanificata, mai l'innerHTML grezzo
  const clean = target.innerText.trim() === '' ? '' : sanitizeCommentHtml(target.innerHTML)
  targetNode.comment = clean || null
}

// Incolla solo testo semplice: niente HTML esterno nel commento
const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '')
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

  /*
  const parentNode = treeStore.findNodeById(myTree.value?.rootNodes || [], node.parentId || '')
  if (!parentNode) {
    return `${node.moveNumber}... `
  }
    */
  // parentId null = prima mossa dell'albero (nessun padre)
  if (node.parentId === null) return `${node.moveNumber}... `


  if (props.isVariantRoot) {
    return `${node.moveNumber}... `
  }

  if (props.afterBlock && (!props.isVariantContext || node.children?.length === 0)) {
    return `${node.moveNumber}... `
  }

  return ''
}

const FIGURINES: Record<string, { cls: string; map: Record<string, string> }> = {
  cases: {
    cls: 'chess-cases-figurine',
    map: { K: 'k', Q: 'q', R: 'r', B: 'b', N: 'n' }
  },
  goodcompanions: {
    cls: 'tgc-figurine',
    map: { K: '0', Q: 'G', R: 'W', B: 'm', N: '©' }
  }
}

interface SanPart { text: string; cls: string }   // cls vuota = testo normale, altrimenti classe della figurina

// Restituisce segmenti di testo, mai HTML: l'escape lo fa l'interpolazione di Vue.
// Figurina per il pezzo iniziale (Nf3) e per il pezzo di promozione (e8=Q, exd1=N+)
const sanParts = (san: string): SanPart[] => {
  const cfg = Object.hasOwn(FIGURINES, props.figurineType) ? FIGURINES[props.figurineType] : null
  if (!cfg) return [{ text: san, cls: '' }]

  const parts: SanPart[] = []
  let rest = san

  const first = cfg.map[san.charAt(0)]
  if (first) {
    parts.push({ text: first, cls: cfg.cls })
    rest = san.slice(1)
  }

  const promo = /^(.*=)([QRBN])(.*)$/.exec(rest)
  if (promo) {
    parts.push({ text: promo[1], cls: '' }, { text: cfg.map[promo[2]], cls: cfg.cls }, { text: promo[3], cls: '' })
  } else {
    parts.push({ text: rest, cls: '' })
  }
  return parts.filter(p => p.text !== '')
}

// Simboli di valutazione (!, ?, +=, ...): tabella e testo in utils/nags.ts
const nagText = (node: ChessMoveNode) => nagsToText(node.nags)
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
  background: var(--t-accent, #3b82f6);
  color: var(--t-accent-fg, #fff) !important;
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
  border-bottom-color: var(--t-accent, #3b82f6);
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
  font-size: 1.05em;
  /* Leggermente più piccolo per uniformarlo alle lettere */
  line-height: 1;
  margin-right: 1px;
  vertical-align: 1px;
  /* Lo spinge più in basso perché i glifi da diagramma tendono a "volare" */
}
</style>