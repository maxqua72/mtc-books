<template>
  <NoteEditor v-if="openNote" :key="openNote.id" :note="openNote" @saved="onSaved" @back="closeNote"
    @share="(n) => share([notes.find(x => x.id === n.id) ?? n])" @remove="(n) => removeNotes([n.id])" />

  <div v-else class="flex flex-col h-dvh bg-neutral-50 font-sans text-neutral-900">
    <!-- Intestazione: titolo, oppure barra della selezione -->
    <header class="flex items-center gap-2 h-14 px-3 bg-white border-b border-neutral-200 shrink-0">
      <template v-if="selecting">
        <button type="button" aria-label="Annulla la selezione" @click="clearSelection"
          class="w-10 h-10 flex items-center justify-center rounded-full active:bg-neutral-100">✕</button>
        <span class="flex-1 text-base font-semibold">{{ selected.size }} selezionati</span>
        <button type="button" :disabled="!selected.size" @click="share(selectedNotes)"
          class="h-10 px-3 rounded-lg text-sm font-semibold active:bg-neutral-100 disabled:opacity-40">
          <i class="fa-solid fa-share-nodes"></i> Condividi
        </button>
        <button type="button" :disabled="!selected.size" @click="removeNotes([...selected])"
          class="h-10 px-3 rounded-lg text-sm font-semibold text-red-600 active:bg-red-50 disabled:opacity-40">
          <i class="fa-solid fa-trash-can"></i> Elimina
        </button>
      </template>
      <template v-else>
        <img :src="logo" alt="" class="h-8 w-auto" />
        <h1 class="flex-1 text-base font-black uppercase tracking-tight">MTC Taccuino</h1>
        <div class="relative">
          <button type="button" aria-label="Menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"
            class="w-10 h-10 flex items-center justify-center rounded-full active:bg-neutral-100">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
          <div v-if="menuOpen" class="absolute right-0 top-11 z-30 w-64 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            <button type="button" class="menu-item" :disabled="!notes.length" @click="menuOpen = false; share(notes)">
              <i class="fa-solid fa-share-nodes"></i> Condividi appunti
            </button>
            <button type="button" class="menu-item" @click="menuOpen = false; openFullEditor()">
              <i class="fa-solid fa-display"></i> Apri l'editor completo
            </button>
            <button type="button" class="menu-item" @click="menuOpen = false; openManualPage('taccuino')">
              <i class="fa-solid fa-circle-question"></i> Manuale
            </button>
          </div>
        </div>
      </template>
    </header>

    <!-- Elenco -->
    <main class="flex-1 overflow-y-auto p-3 pb-24">
      <p v-if="message" class="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900"
        role="status">{{ message }}</p>

      <div v-if="loaded && !notes.length" class="mt-16 px-6 text-center text-neutral-500">
        <i class="fa-regular fa-note-sticky text-4xl mb-3"></i>
        <p class="font-semibold text-neutral-700">Nessun appunto</p>
        <p class="text-sm mt-1">Tocca <b>+</b> per scrivere il primo. Potrai dettare il testo, convertire le mosse e
          aggiungere diagrammi.</p>
      </div>

      <ul class="space-y-2">
        <li v-for="n in notes" :key="n.id">
          <button type="button" class="note-card" :class="{ picked: selected.has(n.id) }"
            @click="onCardClick(n)" @pointerdown="startLongPress(n)" @pointerup="cancelLongPress"
            @pointerleave="cancelLongPress" @pointercancel="cancelLongPress" @contextmenu.prevent>
            <span v-if="selecting" class="check" :class="{ on: selected.has(n.id) }" aria-hidden="true">
              <i v-if="selected.has(n.id)" class="fa-solid fa-check"></i>
            </span>
            <span class="min-w-0 flex-1 text-left">
              <span class="block font-semibold truncate" :class="{ 'text-neutral-400': !n.title.trim() }">{{ noteTitle(n) }}</span>
              <span v-if="notePreview(n)" class="block text-sm text-neutral-600 line-clamp-2">{{ notePreview(n) }}</span>
              <span class="mt-1 flex gap-3 text-xs text-neutral-500">
                <span>{{ formatDate(n.updatedAt) }}</span>
                <span v-if="noteStats(n).diagrams"><i class="fa-solid fa-chess-board"></i> {{ plural(noteStats(n).diagrams, 'diagramma', 'diagrammi') }}</span>
                <span v-if="noteStats(n).lines"><i class="fa-solid fa-chess-pawn"></i> {{ plural(noteStats(n).lines, 'linea', 'linee') }}</span>
              </span>
            </span>
          </button>
        </li>
      </ul>
    </main>

    <button v-if="!selecting" type="button" aria-label="Nuovo appunto" @click="newNote"
      class="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-neutral-900 text-white text-2xl shadow-lg active:scale-95 transition">
      <i class="fa-solid fa-plus"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import logo from '../assets/mtcbooks-logo.svg'
import { deleteNotes, listNotes, putNote } from '../db'
import { openManualPage } from '../utils/manualPage'
import NoteEditor from './NoteEditor.vue'
import { createNote, noteStats, notePreview, noteTitle, type Note } from './notesModel'
import { shareNotes } from './shareNotes'
import { NOTEBOOK_HASH, EDITOR_HASH } from './notebookRoute'

const notes = ref<Note[]>([])
const loaded = ref(false)
const openNote = ref<Note | null>(null)
const menuOpen = ref(false)
const message = ref('')
let messageTimer: ReturnType<typeof setTimeout> | null = null

const say = (text: string) => {
  message.value = text
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = setTimeout(() => { message.value = '' }, 6000)
}

const sortNotes = (list: Note[]) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

onMounted(async () => {
  if (location.hash !== NOTEBOOK_HASH) history.replaceState(null, '', NOTEBOOK_HASH)
  notes.value = await listNotes()
  loaded.value = true
  void navigator.storage?.persist?.().catch(() => { })   // il browser non deve sfrattare gli appunti
  document.addEventListener('pointerdown', onDocumentPointer)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointer))

// --- Apertura e salvataggio ---
async function newNote() {
  const note = createNote()
  await putNote(note)
  notes.value = [note, ...notes.value]
  openNote.value = note
}

const onSaved = (note: Note) => {
  notes.value = sortNotes([note, ...notes.value.filter(n => n.id !== note.id)])
}

// Un appunto lasciato vuoto non resta nell'elenco
async function closeNote() {
  const id = openNote.value?.id
  openNote.value = null
  const note = notes.value.find(n => n.id === id)
  if (note && !note.title.trim() && !note.html) {
    await deleteNotes([note.id])
    notes.value = notes.value.filter(n => n.id !== note.id)
  }
}

// --- Selezione con pressione lunga ---
const selected = ref(new Set<string>())
const selecting = ref(false)
const selectedNotes = computed(() => notes.value.filter(n => selected.value.has(n.id)))
let pressTimer: ReturnType<typeof setTimeout> | null = null
let longPressed = false

const toggle = (id: string) => {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  selected.value = next
}
const startLongPress = (n: Note) => {
  longPressed = false
  cancelLongPress()
  pressTimer = setTimeout(() => {
    longPressed = true
    selecting.value = true
    if (!selected.value.has(n.id)) toggle(n.id)
    navigator.vibrate?.(20)
  }, 500)
}
function cancelLongPress() {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
}
const onCardClick = (n: Note) => {
  if (longPressed) { longPressed = false; return }   // il tocco lungo ha già selezionato
  if (selecting.value) toggle(n.id)
  else openNote.value = n
}
const clearSelection = () => {
  selected.value = new Set()
  selecting.value = false
}

// --- Azioni ---
async function share(list: Note[]) {
  if (!list.length) return
  try {
    const outcome = await shareNotes(list)
    if (outcome === 'downloaded') {
      say('File scaricato: lo trovi tra i download del telefono. Da lì puoi mandarlo a te stesso (email, Drive…).')
    }
    if (outcome !== 'cancelled') clearSelection()
  } catch (e) {
    console.error('[taccuino] condivisione', e)
    say('Non è stato possibile preparare il file degli appunti.')
  }
}

async function removeNotes(ids: string[]) {
  if (!ids.length) return
  const text = ids.length === 1 ? 'Eliminare questo appunto?' : `Eliminare ${ids.length} appunti?`
  if (!confirm(`${text} L'operazione non si può annullare.`)) return
  await deleteNotes(ids)
  const gone = new Set(ids)
  notes.value = notes.value.filter(n => !gone.has(n.id))
  if (openNote.value && gone.has(openNote.value.id)) openNote.value = null
  clearSelection()
}

function openFullEditor() {
  location.hash = EDITOR_HASH
  location.reload()
}

const onDocumentPointer = (e: PointerEvent) => {
  if (menuOpen.value && !(e.target as HTMLElement | null)?.closest('[aria-label="Menu"], .menu-item')) menuOpen.value = false
}

// --- Formattazione ---
const formatDate = (iso: string) => {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? `oggi, ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
</script>

<style scoped>
.note-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  padding: 0.8rem 0.9rem;
  border-radius: 0.75rem;
  background: #fff;
  border: 1px solid #e5e5e5;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
}
.note-card:active { background: #f5f5f5; }
.note-card.picked { border-color: #171717; background: #f5f5f5; }
.check {
  flex: 0 0 auto;
  width: 1.4rem;
  height: 1.4rem;
  margin-top: 0.1rem;
  border-radius: 50%;
  border: 2px solid #a3a3a3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: #fff;
}
.check.on { background: #171717; border-color: #171717; }
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
.menu-item:disabled { opacity: 0.4; }
</style>
