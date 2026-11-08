<template>
  <div class="flex flex-col h-dvh bg-white">
    <!-- Intestazione: indietro, titolo, menu -->
    <header class="flex items-center gap-1 h-14 px-2 border-b border-neutral-200 shrink-0">
      <button type="button" aria-label="Torna agli appunti" @click="goBack"
        class="w-10 h-10 flex items-center justify-center rounded-full text-neutral-700 active:bg-neutral-100">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <input v-model="title" type="text" placeholder="Titolo dell'appunto" aria-label="Titolo dell'appunto"
        enterkeyhint="next" @keydown.enter.prevent="editor?.commands.focus('end')"
        class="flex-1 min-w-0 h-10 px-2 text-base font-semibold text-neutral-900 bg-transparent focus:outline-none" />
      <div class="relative">
        <button type="button" aria-label="Altre azioni" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"
          class="w-10 h-10 flex items-center justify-center rounded-full text-neutral-700 active:bg-neutral-100">
          <i class="fa-solid fa-ellipsis-vertical"></i>
        </button>
        <div v-if="menuOpen" class="absolute right-0 top-11 z-30 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          <button type="button" class="menu-item" @click="menuOpen = false; void share()">
            <i class="fa-solid fa-share-nodes"></i> Condividi
          </button>
          <button type="button" class="menu-item text-red-600" @click="menuOpen = false; remove()">
            <i class="fa-solid fa-trash-can"></i> Elimina
          </button>
        </div>
      </div>
    </header>

    <!-- Testo dell'appunto -->
    <div class="relative flex-1 overflow-y-auto" @click.self="editor?.commands.focus('end')">
      <p v-if="isEmpty" class="pointer-events-none absolute left-4 top-3 text-neutral-400">
        Scrivi o detta un appunto…
      </p>
      <EditorContent :editor="editor" class="note-text" :style="{ paddingBottom: `${toolbarSpace}px` }" />
    </div>

    <!-- Barra degli strumenti agganciata sopra la tastiera -->
    <nav class="note-toolbar" :style="{ bottom: `${keyboardOffset}px` }" aria-label="Strumenti dell'appunto">
      <button type="button" class="tb-btn tb-main" @pointerdown.prevent @click="openBoard">
        <i class="fa-solid fa-chess-knight"></i> Scacchiera
      </button>
      <button type="button" class="tb-btn tb-main" @pointerdown.prevent @click="convert.open()">
        <i class="fa-solid fa-wand-magic-sparkles"></i> Converti mosse
      </button>
      <button type="button" class="tb-btn" aria-label="Grassetto" :class="{ on: editor?.isActive('bold') }"
        @pointerdown.prevent @click="editor?.chain().focus().toggleBold().run()"><b>G</b></button>
      <button type="button" class="tb-btn" aria-label="Corsivo" :class="{ on: editor?.isActive('italic') }"
        @pointerdown.prevent @click="editor?.chain().focus().toggleItalic().run()"><i>C</i></button>
      <button type="button" class="tb-btn" aria-label="Annulla" @pointerdown.prevent
        @click="editor?.chain().focus().undo().run()"><i class="fa-solid fa-rotate-left"></i></button>
    </nav>

    <BoardSheet :request="sheet?.request ?? null" @close="closeSheet(true)" @diagram="onDiagram" @line="onLine"
      @remove="onRemove" />
    <DictatedMovesModal :is-open="convert.isOpen.value" :items="convert.items.value" @close="convert.close()"
      @apply="convert.apply" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { NodeSelection } from '@tiptap/pm/state'
import { useChessTreeStore, type ChessMoveNode, type ChessTree } from '../stores/chessTreeStore'
import { useConvertDictatedMoves } from '../composables/useConvertDictatedMoves'
import DictatedMovesModal from '../components/DictatedMovesModal.vue'
import { extractTreeIds } from '../utils/html'
import { putNote } from '../db'
import BoardSheet, { type SheetRequest } from './BoardSheet.vue'
import { noteExtensions } from './noteExtensions'
import { EDIT_NODE_EVENT, makeLineTree, type Note } from './notesModel'

const props = defineProps<{ note: Note }>()
const emit = defineEmits<{
  (e: 'saved', note: Note): void
  (e: 'back'): void
  (e: 'share', note: Note): void
  (e: 'remove', note: Note): void
}>()

const SAVE_DELAY = 500
const treeStore = useChessTreeStore()

// Gli alberi dell'appunto vivono nello store, come quelli di un capitolo: le viste delle linee li leggono da lì
treeStore.setChapterTrees(JSON.parse(JSON.stringify(props.note.trees)) as ChessTree[])

const title = ref(props.note.title)
const isEmpty = ref(!props.note.html)
let dirty = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

const editor = useEditor({
  content: props.note.html,
  extensions: noteExtensions(),
  editorProps: {
    attributes: {
      class: 'focus:outline-none px-4 py-3',
      autocapitalize: 'sentences',
      spellcheck: 'true',
    },
  },
  onUpdate({ editor }) {
    isEmpty.value = editor.isEmpty
    touch()
  },
})

const convert = useConvertDictatedMoves(editor)

// --- Salvataggio automatico ---
function touch() {
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void save() }, SAVE_DELAY)
}

async function save() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  const ed = editor.value
  if (!dirty || !ed || ed.isDestroyed) return
  dirty = false
  const html = ed.isEmpty ? '' : ed.getHTML()
  const used = new Set(extractTreeIds(html))
  const note: Note = {
    ...props.note,
    title: title.value.trim(),
    html,
    trees: treeStore.trees.filter(t => used.has(t.id)),
    updatedAt: new Date().toISOString(),
  }
  await putNote(note)
  emit('saved', JSON.parse(JSON.stringify(note)) as Note)
}

watch(title, touch)

const goBack = async () => {
  await save()
  emit('back')
}

const share = async () => {
  dirty = true   // si salva anche un appunto appena aperto: si condivide ciò che si vede
  await save()
  emit('share', { ...props.note, title: title.value.trim() })
}

const remove = () => emit('remove', props.note)

// visibilitychange è l'unico evento affidabile quando si cambia app sul telefono
const onVisibility = () => { if (document.visibilityState === 'hidden') void save() }

// --- Tastiera virtuale: la barra le resta sopra ---
const keyboardOffset = ref(0)
const toolbarSpace = 72
const onViewport = () => {
  const vv = window.visualViewport
  if (!vv) return
  keyboardOffset.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
}

// --- Pannello Scacchiera ---
type SheetState =
  | { request: SheetRequest; target: null }
  | { request: SheetRequest; target: { kind: 'diagram' | 'line'; pos: number } }
const sheet = ref<SheetState | null>(null)
const menuOpen = ref(false)

const openBoard = () => {
  editor.value?.commands.blur()   // la tastiera si chiude: il pannello ne prende il posto
  sheet.value = { request: { kind: 'new', flipped: treeStore.boardFlipped }, target: null }
}

function closeSheet(refocus: boolean) {
  sheet.value = null
  if (refocus) editor.value?.commands.focus()
}

/** Diagramma o linea toccati nel testo: il pannello si apre su quel contenuto */
const onEditNode = (e: Event) => {
  const pos = (e as CustomEvent<{ pos?: number }>).detail?.pos
  const ed = editor.value
  if (typeof pos !== 'number' || !ed) return
  const node = ed.state.doc.nodeAt(pos)
  if (!node) return
  ed.commands.blur()
  if (node.type.name === 'chessDiagram') {
    sheet.value = {
      request: { kind: 'diagram', fen: node.attrs.fen, flipped: !!node.attrs.flipped },
      target: { kind: 'diagram', pos },
    }
  } else if (node.type.name === 'chessTreeBlock') {
    const tree = treeStore.trees.find(t => t.id === node.attrs.treeId)
    if (!tree) return
    sheet.value = {
      request: { kind: 'line', startFen: tree.startingFen, rootNodes: tree.rootNodes, flipped: treeStore.boardFlipped },
      target: { kind: 'line', pos },
    }
  }
}

/** Punto di inserimento: dopo il blocco del cursore (come «Inserisci diagramma» nel libro) */
function insertionPos(): number {
  const { selection } = editor.value!.state
  return selection instanceof NodeSelection || selection.$to.depth === 0 ? selection.to : selection.$to.after(1)
}

/** Inserisce un blocco seguito da un paragrafo vuoto e vi porta il cursore */
function insertBlock(block: object) {
  const ed = editor.value
  if (!ed) return
  const pos = insertionPos()
  ed.chain().insertContentAt(pos, [block, { type: 'paragraph' }]).run()
  sheet.value = null
  ed.commands.focus()
}

function onDiagram(fen: string, flipped: boolean) {
  const ed = editor.value
  const s = sheet.value
  if (!ed || !s) return
  treeStore.boardFlipped = flipped
  if (s.target?.kind === 'diagram') {
    const node = ed.state.doc.nodeAt(s.target.pos)
    if (node?.type.name === 'chessDiagram') {
      ed.view.dispatch(ed.state.tr.setNodeMarkup(s.target.pos, undefined, { ...node.attrs, fen, flipped }))
    }
    closeSheet(false)
    return
  }
  insertBlock({ type: 'chessDiagram', attrs: { fen, flipped } })
}

function onLine(startFen: string, rootNodes: ChessMoveNode[]) {
  const ed = editor.value
  const s = sheet.value
  if (!ed || !s) return
  if (s.target?.kind === 'line') {
    const node = ed.state.doc.nodeAt(s.target.pos)
    const tree = node ? treeStore.trees.find(t => t.id === node.attrs.treeId) : undefined
    if (tree) {
      // Stesso albero, mosse nuove: il documento non cambia, quindi il salvataggio si chiede a mano
      tree.startingFen = startFen
      tree.rootNodes = rootNodes
      tree.activeNodeId = null
      touch()
    }
    closeSheet(false)
    return
  }
  const tree = makeLineTree(startFen, rootNodes, `Linea ${treeStore.trees.length + 1}`)
  treeStore.trees.push(tree)
  insertBlock({ type: 'chessTreeBlock', attrs: { treeId: tree.id } })
}

function onRemove() {
  const ed = editor.value
  const target = sheet.value?.target
  if (!ed || !target) return
  const node = ed.state.doc.nodeAt(target.pos)
  if (node) ed.view.dispatch(ed.state.tr.delete(target.pos, target.pos + node.nodeSize))
  closeSheet(false)
}

// Menu: un tocco fuori lo chiude
const onDocumentPointer = (e: PointerEvent) => {
  if (menuOpen.value && !(e.target as HTMLElement | null)?.closest('[aria-label="Altre azioni"], .menu-item')) {
    menuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener(EDIT_NODE_EVENT, onEditNode)
  document.addEventListener('visibilitychange', onVisibility)
  document.addEventListener('pointerdown', onDocumentPointer)
  window.visualViewport?.addEventListener('resize', onViewport)
  window.visualViewport?.addEventListener('scroll', onViewport)
  // Appunto nuovo: si parte dal titolo
  if (!props.note.title && !props.note.html) {
    requestAnimationFrame(() => (document.querySelector('input[aria-label="Titolo dell\'appunto"]') as HTMLInputElement | null)?.focus())
  }
})

onBeforeUnmount(() => {
  window.removeEventListener(EDIT_NODE_EVENT, onEditNode)
  document.removeEventListener('visibilitychange', onVisibility)
  document.removeEventListener('pointerdown', onDocumentPointer)
  window.visualViewport?.removeEventListener('resize', onViewport)
  window.visualViewport?.removeEventListener('scroll', onViewport)
  void save()
})

defineExpose({ save, isEmpty: computed(() => isEmpty.value && !title.value.trim()) })
</script>

<style scoped>
.note-text :deep(.ProseMirror) {
  min-height: 100%;
  font-size: 1.05rem;
  line-height: 1.55;
  color: #171717;
}
.note-text :deep(.ProseMirror p) { margin: 0 0 0.6rem; }
.note-text :deep(.ProseMirror ul) { list-style: disc; padding-left: 1.4rem; }
.note-text :deep(.ProseMirror ol) { list-style: decimal; padding-left: 1.4rem; }
.note-text :deep(.fig-hidden) { display: none !important; }
.note-text :deep(.tgc-figurine) {
  font-family: 'Chess The Good Companions', sans-serif !important;
  font-weight: normal !important;
  font-style: normal !important;
  font-size: 1.05em;
  line-height: 1;
  margin-right: 1px;
  vertical-align: 1px;
}
.note-text :deep(.chess-cases-figurine) {
  font-family: 'Chess Cases', sans-serif !important;
  font-weight: normal !important;
  font-style: normal !important;
  font-size: 1.15em;
  line-height: 1;
  vertical-align: -3px;
}
.note-toolbar {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  gap: 0.2rem;
  padding: 0.4rem 0.4rem calc(0.4rem + env(safe-area-inset-bottom));
  background: #fafafa;
  border-top: 1px solid #e5e5e5;
  overflow-x: auto;
}
.tb-btn {
  flex: 0 0 auto;
  min-width: 2.3rem;
  height: 2.5rem;
  padding: 0 0.4rem;
  border-radius: 0.5rem;
  color: #404040;
  font-size: 0.95rem;
}
.tb-btn:active, .tb-btn.on { background: #e5e5e5; color: #171717; }
.tb-main { padding: 0 0.55rem; font-size: 0.8rem; font-weight: 600; background: #fff; border: 1px solid #d4d4d4; }
.menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.7rem 1rem;
  font-size: 0.95rem;
  text-align: left;
}
.menu-item:active { background: #f5f5f5; }
</style>
