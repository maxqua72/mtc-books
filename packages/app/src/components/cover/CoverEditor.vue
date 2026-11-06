<template>
  <div class="th-desk flex flex-col h-full min-h-0 bg-neutral-100">
    <!-- Barra degli strumenti -->
    <div class="th-toolbar shrink-0 border-b border-neutral-200 bg-white px-3 py-2 space-y-2"
      :inert="readOnly">
      <div class="flex flex-wrap items-center gap-2">
        <button class="cv-btn" @click="fileInput?.click()">
          <i class="fa-solid fa-image"></i>
          {{ imageUrl ? 'Cambia immagine' : 'Scegli immagine' }}
        </button>
        <button v-if="imageUrl" class="cv-btn" title="Rimuovi immagine" @click="emit('remove-image')">
          <i class="fa-solid fa-trash"></i>
        </button>
        <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden"
          @change="onFileChange" />

        <span class="w-px h-6 bg-neutral-200 mx-1"></span>

        <button class="cv-btn" @click="addText">
          <i class="fa-solid fa-font"></i> Aggiungi testo
        </button>

        <span class="ml-auto text-[11px] text-neutral-400">
          Trascina per spostare · doppio clic per modificare · Canc per eliminare
        </span>
      </div>

      <!-- Inquadratura dell'immagine -->
      <div v-if="cover.image && imageUrl" class="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <label class="flex items-center gap-2">Zoom
          <input type="range" min="1" max="3" step="0.01" class="w-28"
            :value="cover.image.zoom" @input="updateImage({ zoom: Number(val($event)) })" />
        </label>
        <label class="flex items-center gap-2">Orizzontale
          <input type="range" min="0" max="100" step="1" class="w-28"
            :value="cover.image.x" @input="updateImage({ x: Number(val($event)) })" />
        </label>
        <label class="flex items-center gap-2">Verticale
          <input type="range" min="0" max="100" step="1" class="w-28"
            :value="cover.image.y" @input="updateImage({ y: Number(val($event)) })" />
        </label>
      </div>

      <!-- Stile del testo selezionato -->
      <div v-if="selected" class="flex flex-wrap items-center gap-2 text-xs">
        <select class="cv-input" :value="selected.fontFamily"
          @change="updateSelected({ fontFamily: val($event) as CoverFontKey })">
          <option v-for="(f, key) in COVER_FONTS" :key="key" :value="key">{{ f.label }}</option>
        </select>

        <label class="flex items-center gap-1 text-neutral-500">pt
          <input type="number" min="4" max="300" step="1" class="cv-input w-16"
            :value="selected.fontSize"
            @change="updateSelected({ fontSize: clamp(Number(val($event)) || 4, 4, 300) })" />
        </label>

        <button class="cv-btn" :class="{ active: selected.bold }" title="Grassetto"
          @click="updateSelected({ bold: !selected.bold })"><i class="fa-solid fa-bold"></i></button>
        <button class="cv-btn" :class="{ active: selected.italic }" title="Corsivo"
          @click="updateSelected({ italic: !selected.italic })"><i class="fa-solid fa-italic"></i></button>

        <span class="w-px h-6 bg-neutral-200 mx-1"></span>

        <button class="cv-btn" :class="{ active: selected.align === 'left' }" title="Allinea a sinistra"
          @click="updateSelected({ align: 'left' })"><i class="fa-solid fa-align-left"></i></button>
        <button class="cv-btn" :class="{ active: selected.align === 'center' }" title="Centra"
          @click="updateSelected({ align: 'center' })"><i class="fa-solid fa-align-center"></i></button>
        <button class="cv-btn" :class="{ active: selected.align === 'right' }" title="Allinea a destra"
          @click="updateSelected({ align: 'right' })"><i class="fa-solid fa-align-right"></i></button>

        <span class="w-px h-6 bg-neutral-200 mx-1"></span>

        <input type="color" class="w-8 h-8 p-0 border border-neutral-200 rounded cursor-pointer bg-white"
          title="Colore" :value="selected.color" @input="updateSelected({ color: val($event) })" />

        <button class="cv-btn" title="Elimina testo" @click="removeText(selected.id)">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>

    <!-- Area di lavoro: la pagina è scalata per stare in larghezza. In sola lettura si blocca il foglio, non lo scorrimento -->
    <div ref="viewport" class="flex-1 min-h-0 overflow-auto p-8" @pointerdown.self="selectedId = null">
      <div class="mx-auto" :style="{ width: pagePxW * scale + 'px', height: pagePxH * scale + 'px' }">
        <div ref="pageEl" class="cover-page-editor" tabindex="0" :inert="readOnly"
          :style="{ width: pagePxW + 'px', height: pagePxH + 'px', transform: `scale(${scale})` }"
          @pointerdown.self="selectedId = null" @keydown="onPageKeydown">

          <img v-if="imageUrl && cover.image" :src="imageUrl" alt="" draggable="false"
            class="cover-image-editor" :style="coverImageStyle(cover.image)" />
          <div v-else-if="!imageUrl" class="cover-placeholder">Nessuna immagine di sfondo</div>

          <div v-for="t in cover.texts" :key="t.id + (editingId === t.id ? ':edit' : '')"
            :ref="(el) => setTextRef(t.id, el)"
            class="cover-text-editor"
            :class="{ selected: selectedId === t.id, editing: editingId === t.id }"
            :style="coverTextStyle(t)"
            :contenteditable="editingId === t.id"
            :spellcheck="false"
            @pointerdown="onTextPointerDown($event, t)"
            @pointermove="onTextPointerMove"
            @pointerup="onTextPointerUp"
            @pointercancel="onTextPointerUp"
            @dblclick="startEdit(t)"
            @blur="commitEdit(t)"
            @paste.prevent="onPaste">{{ t.text }}<span v-if="selectedId === t.id && editingId !== t.id"
              class="resize-handle" title="Larghezza"
              @pointerdown.stop="onResizeDown($event, t)"
              @pointermove="onResizeMove"
              @pointerup="onResizeUp"
              @pointercancel="onResizeUp"></span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  COVER_FONTS, MM_TO_PX, coverTextStyle, coverImageStyle, createCoverText,
  type BookCover, type CoverTextElement, type CoverFontKey, type CoverImage
} from '../../utils/cover'

const props = defineProps<{
  imageUrl: string | null
  pageWidthMm: number
  pageHeightMm: number
  readOnly?: boolean
}>()

const cover = defineModel<BookCover>({ required: true })

const emit = defineEmits<{
  (e: 'pick-image', file: File): void
  (e: 'remove-image'): void
}>()

const val = (e: Event) => (e.target as HTMLInputElement | HTMLSelectElement).value
const round1 = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

// ---------------------------------------------------------------------------
// Scala di visualizzazione (la pagina ha sempre la sua dimensione reale in mm)
// ---------------------------------------------------------------------------
const viewport = ref<HTMLElement | null>(null)
const pageEl = ref<HTMLElement | null>(null)
const viewportWidth = ref(900)
let resizeObserver: ResizeObserver | null = null

const pagePxW = computed(() => props.pageWidthMm * MM_TO_PX)
const pagePxH = computed(() => props.pageHeightMm * MM_TO_PX)
const scale = computed(() =>
  Math.min(1.25, Math.max(0.2, (viewportWidth.value - 64) / pagePxW.value))
)

onMounted(() => {
  if (!viewport.value) return
  viewportWidth.value = viewport.value.clientWidth
  resizeObserver = new ResizeObserver(() => {
    if (viewport.value) viewportWidth.value = viewport.value.clientWidth
  })
  resizeObserver.observe(viewport.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())

// ---------------------------------------------------------------------------
// Selezione e modifica del modello
// ---------------------------------------------------------------------------
const selectedId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const selected = computed(() => cover.value.texts.find(t => t.id === selectedId.value) ?? null)

const updateText = (id: string, patch: Partial<CoverTextElement>) => {
  cover.value = {
    ...cover.value,
    texts: cover.value.texts.map(t => (t.id === id ? { ...t, ...patch } : t))
  }
}
const updateSelected = (patch: Partial<CoverTextElement>) => {
  if (selectedId.value) updateText(selectedId.value, patch)
}
const updateImage = (patch: Partial<CoverImage>) => {
  if (!cover.value.image) return
  cover.value = { ...cover.value, image: { ...cover.value.image, ...patch } }
}
const removeText = (id: string) => {
  textRefs.delete(id)
  if (selectedId.value === id) selectedId.value = null
  if (editingId.value === id) editingId.value = null
  cover.value = { ...cover.value, texts: cover.value.texts.filter(t => t.id !== id) }
}

const addText = () => {
  const t = createCoverText({ y: clamp(10 + cover.value.texts.length * 10, 0, 85) })
  cover.value = { ...cover.value, texts: [...cover.value.texts, t] }
  startEdit(t, true)
}

// ---------------------------------------------------------------------------
// Immagine
// ---------------------------------------------------------------------------
const fileInput = ref<HTMLInputElement | null>(null)

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('pick-image', file)
  input.value = '' // permette di riscegliere lo stesso file
}

// ---------------------------------------------------------------------------
// Modifica del testo (doppio clic)
// ---------------------------------------------------------------------------
const textRefs = new Map<string, HTMLElement>()
const setTextRef = (id: string, el: unknown) => {
  if (el instanceof HTMLElement) textRefs.set(id, el)
}

const startEdit = async (t: CoverTextElement, selectAll = false) => {
  selectedId.value = t.id
  editingId.value = t.id
  await nextTick() // la chiave cambia: l'elemento viene ricreato in modalità modifica
  const node = textRefs.get(t.id)
  if (!node) return
  node.focus()
  const range = document.createRange()
  range.selectNodeContents(node)
  if (!selectAll) range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

const commitEdit = (t: CoverTextElement) => {
  if (editingId.value !== t.id) return
  const text = (textRefs.get(t.id)?.innerText ?? t.text).replace(/\n+$/, '')
  editingId.value = null
  if (text.trim() === '') removeText(t.id)
  else updateText(t.id, { text })
}

// Solo testo semplice: niente HTML incollato nell'elemento
const onPaste = (e: ClipboardEvent) => {
  document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '')
}

// ---------------------------------------------------------------------------
// Trascinamento e ridimensionamento
// ---------------------------------------------------------------------------
interface DragState { id: string; startX: number; startY: number; origX: number; origY: number; hPct: number }
let drag: DragState | null = null

const onTextPointerDown = (e: PointerEvent, t: CoverTextElement) => {
  if (editingId.value === t.id) return // in modifica: comportamento nativo del cursore
  e.preventDefault()

  // preventDefault impedisce il blur nativo: chiudiamo a mano l'eventuale altra modifica
  if (editingId.value) textRefs.get(editingId.value)?.blur()

  selectedId.value = t.id
  pageEl.value?.focus({ preventScroll: true })

  const node = e.currentTarget as HTMLElement
  node.setPointerCapture(e.pointerId)
  const heightPx = node.getBoundingClientRect().height
  drag = {
    id: t.id,
    startX: e.clientX,
    startY: e.clientY,
    origX: t.x,
    origY: t.y,
    hPct: (heightPx / scale.value / pagePxH.value) * 100
  }
}

const onTextPointerMove = (e: PointerEvent) => {
  if (!drag) return
  const t = cover.value.texts.find(x => x.id === drag!.id)
  if (!t) return
  const dx = ((e.clientX - drag.startX) / scale.value / pagePxW.value) * 100
  const dy = ((e.clientY - drag.startY) / scale.value / pagePxH.value) * 100
  updateText(t.id, {
    x: round1(clamp(drag.origX + dx, 0, Math.max(0, 100 - t.width))),
    y: round1(clamp(drag.origY + dy, 0, Math.max(0, 100 - drag.hPct)))
  })
}
const onTextPointerUp = () => { drag = null }

interface ResizeState { id: string; startX: number; origW: number }
let resize: ResizeState | null = null

const onResizeDown = (e: PointerEvent, t: CoverTextElement) => {
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  resize = { id: t.id, startX: e.clientX, origW: t.width }
}
const onResizeMove = (e: PointerEvent) => {
  if (!resize) return
  const t = cover.value.texts.find(x => x.id === resize!.id)
  if (!t) return
  const dw = ((e.clientX - resize.startX) / scale.value / pagePxW.value) * 100
  updateText(t.id, { width: round1(clamp(resize.origW + dw, 5, 100 - t.x)) })
}
const onResizeUp = () => { resize = null }

// ---------------------------------------------------------------------------
// Tastiera (con la pagina a fuoco)
// ---------------------------------------------------------------------------
const nudge = (dx: number, dy: number) => {
  const t = selected.value
  if (!t) return
  const heightPx = textRefs.get(t.id)?.getBoundingClientRect().height ?? 0
  const hPct = (heightPx / scale.value / pagePxH.value) * 100
  updateText(t.id, {
    x: round1(clamp(t.x + dx, 0, Math.max(0, 100 - t.width))),
    y: round1(clamp(t.y + dy, 0, Math.max(0, 100 - hPct)))
  })
}

const onPageKeydown = (e: KeyboardEvent) => {
  if (editingId.value) {
    if (e.key === 'Escape') textRefs.get(editingId.value)?.blur()
    return
  }
  const t = selected.value
  if (!t) return
  const step = e.shiftKey ? 2 : 0.5

  switch (e.key) {
    case 'Delete':
    case 'Backspace': removeText(t.id); break
    case 'Enter': startEdit(t); break
    case 'Escape': selectedId.value = null; break
    case 'ArrowLeft': nudge(-step, 0); break
    case 'ArrowRight': nudge(step, 0); break
    case 'ArrowUp': nudge(0, -step); break
    case 'ArrowDown': nudge(0, step); break
    default: return
  }
  e.preventDefault()
}
</script>

<style scoped>
.cover-page-editor {
  position: relative;
  overflow: hidden;            /* come nel PDF: ciò che esce dal foglio non conta */
  background: #ffffff;
  transform-origin: top left;
  box-shadow: 0 1px 10px rgba(0, 0, 0, 0.2);
  outline: none;
  user-select: none;
}

.cover-image-editor { pointer-events: none; }

.cover-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a3a3a3;
  font: 14pt ui-sans-serif, system-ui, sans-serif;
  pointer-events: none;
}

.cover-text-editor { cursor: move; touch-action: none; }
.cover-text-editor:hover { outline: 1px dashed #60a5fa; }
.cover-text-editor.selected { outline: 2px solid #3b82f6; }
.cover-text-editor.editing {
  cursor: text;
  user-select: text;
  outline: 2px solid #3b82f6;
  background: rgba(255, 255, 255, 0.25);
}

.resize-handle {
  position: absolute;
  right: -7px;
  top: 50%;
  width: 10px;
  height: 24px;
  margin-top: -12px;
  background: #3b82f6;
  border-radius: 3px;
  cursor: ew-resize;
  touch-action: none;
}

.cv-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 2rem;
  padding: 0 0.7rem;
  border-radius: 0.375rem;
  border: 1px solid var(--t-surface-border, #e5e5e5);
  background: var(--t-surface-bg, #ffffff);
  color: var(--t-surface-fg, var(--t-text, #262626));
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.cv-btn:hover { background: var(--t-surface-hover, #f5f5f5); }
.cv-btn.active { background: var(--t-btn-bg, #171717); color: var(--t-btn-fg, #ffffff); border-color: var(--t-btn-bg, #171717); }

.cv-input {
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--t-surface-border, #e5e5e5);
  border-radius: 0.375rem;
  background: var(--t-surface-bg, #ffffff);
  color: var(--t-surface-fg, var(--t-text, inherit));
  font-size: 0.75rem;
}
</style>