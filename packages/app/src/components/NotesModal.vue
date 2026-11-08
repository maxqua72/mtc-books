<template>
  <BaseModal :is-open="isOpen" width-class="max-w-2xl" labelledby="notes-modal-title" @close="emit('close')">
    <div class="flex items-center justify-between gap-3 border-b border-neutral-200 px-6 py-4">
      <h3 id="notes-modal-title" class="text-lg font-semibold text-neutral-900">Appunti</h3>
      <div class="flex items-center gap-2">
        <button type="button" @click="importFile" :disabled="busy"
          class="bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-neutral-800 transition disabled:opacity-40">
          <i class="fa-solid fa-file-import"></i> Importa appunti…
        </button>
        <button @click="emit('close')" aria-label="Chiudi"
          class="text-neutral-400 hover:text-neutral-700 transition p-1 rounded-md hover:bg-neutral-100">✕</button>
      </div>
    </div>

    <div class="px-6 py-4 max-h-[65vh] overflow-y-auto">
      <p v-if="message" class="mb-3 rounded-lg border px-3 py-2 text-sm" role="status"
        :class="messageIsError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-900'">
        {{ message }}
      </p>
      <p v-if="blocked" class="mb-3 text-xs text-amber-700">
        <i class="fa-solid fa-circle-info"></i> {{ blocked }}
      </p>

      <div v-if="loaded && !notes.length" class="py-8 text-center text-sm text-neutral-500">
        <p class="font-medium text-neutral-700">Nessun appunto</p>
        <p class="mt-1">Scrivi gli appunti con il Taccuino sul telefono, condividili e poi usa «Importa appunti…».</p>
      </div>

      <ul class="space-y-2">
        <li v-for="n in notes" :key="n.id" class="rounded-lg border border-neutral-200 px-4 py-3">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-neutral-900 truncate">{{ noteTitle(n) }}</p>
              <p v-if="notePreview(n)" class="text-sm text-neutral-600 line-clamp-2">{{ notePreview(n) }}</p>
              <p class="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
                <span>{{ formatDate(n.updatedAt) }}</span>
                <span v-if="noteStats(n).diagrams">{{ plural(noteStats(n).diagrams, 'diagramma', 'diagrammi') }}</span>
                <span v-if="noteStats(n).lines">{{ plural(noteStats(n).lines, 'linea', 'linee') }}</span>
                <span v-if="n.insertedIn?.length" class="text-emerald-700">
                  <i class="fa-solid fa-check"></i> Già inserito in: {{ n.insertedIn.map(i => i.title).join(', ') }}
                </span>
              </p>
            </div>
            <button type="button" @click="remove(n)" aria-label="Elimina l'appunto" v-tooltip="'Elimina l\'appunto'"
              class="text-neutral-400 hover:text-red-600 transition p-1.5 rounded-md hover:bg-red-50">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
          <div class="mt-2 flex flex-wrap gap-2">
            <button type="button" :disabled="!!cursorBlocked || busy" @click="insert(n, 'cursor')"
              v-tooltip.desc="cursorBlocked ?? 'Inserisce l\'appunto nel capitolo aperto, dopo il paragrafo del cursore'"
              class="action">Inserisci al cursore</button>
            <button type="button" :disabled="!!blocked || busy" @click="insert(n, 'section')"
              v-tooltip.desc="blocked ?? 'Crea un nuovo capitolo con il titolo e il testo dell\'appunto'"
              class="action">Inserisci come nuova sezione</button>
          </div>
        </li>
      </ul>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import { platform } from '../platform'
import { deleteNotes, listNotes } from '../db'
import { BookTooNewError } from '../stores/book/mtcbookIO'
import { noteStats, notePreview, noteTitle, type Note } from '../notebook/notesModel'
import {
  cursorBlockedReason, importNotesFile, insertBlockedReason, insertNoteAsSection, insertNoteAtCursor,
} from '../notebook/notesIO'
import { vTooltip } from '../directives/tooltip'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const notes = ref<Note[]>([])
const loaded = ref(false)
const busy = ref(false)
const message = ref('')
const messageIsError = ref(false)

const blocked = computed(() => (props.isOpen ? insertBlockedReason() : null))
const cursorBlocked = computed(() => (props.isOpen ? cursorBlockedReason() : null))

const say = (text: string, error = false) => {
  message.value = text
  messageIsError.value = error
}

async function refresh() {
  notes.value = await listNotes()
  loaded.value = true
}

watch(() => props.isOpen, (open) => {
  if (!open) return
  say('')
  void refresh()
}, { immediate: true })

async function importFile() {
  const picked = await platform.files.pickBook()
  if (!picked) return
  busy.value = true
  try {
    const { added, updated } = await importNotesFile(picked.data)
    const parts = [plural(added, 'appunto nuovo', 'appunti nuovi')]
    if (updated) parts.push(plural(updated, 'aggiornato', 'aggiornati'))
    say(`Importati da «${picked.name}»: ${parts.join(', ')}.`)
    await refresh()
  } catch (e) {
    console.error('[appunti] importazione', e)
    say(e instanceof BookTooNewError ? e.message : `Impossibile leggere «${picked.name}»: non è un file di appunti valido.`, true)
  } finally {
    busy.value = false
  }
}

async function insert(note: Note, where: 'cursor' | 'section') {
  busy.value = true
  try {
    const updated = where === 'cursor' ? await insertNoteAtCursor(note) : await insertNoteAsSection(note)
    if (!updated) return
    notes.value = notes.value.map(n => (n.id === updated.id ? updated : n))
    emit('close')
  } finally {
    busy.value = false
  }
}

async function remove(note: Note) {
  if (!confirm(`Eliminare l'appunto «${noteTitle(note)}»? L'operazione non si può annullare. Ciò che hai già inserito nei libri resta.`)) return
  await deleteNotes([note.id])
  notes.value = notes.value.filter(n => n.id !== note.id)
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
</script>

<style scoped>
.action {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--color-neutral-300, #d4d4d4);
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-neutral-700, #404040);
  transition: background 0.15s;
}
.action:hover:not(:disabled) { background: var(--color-neutral-100, #f5f5f5); }
.action:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
