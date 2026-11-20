<template>
  <!-- Un solo indicatore per copia interna e file: icona, testo breve, nome corto del file.
       Il clic apre i dettagli (ora, cartella, salvataggio automatico) e i comandi di salvataggio -->
  <div class="relative min-w-0" v-click-outside="close">
    <!-- La direttiva del tooltip usa il suo testo anche come nome accessibile: contiene lo stato completo -->
    <button type="button" @click="toggle" :aria-expanded="open" aria-haspopup="dialog"
      v-tooltip="open ? null : description"
      class="status-btn flex items-center gap-2 min-w-0 max-w-full -ml-2 px-2 py-1 rounded-md transition cursor-pointer"
      :class="[`tone-${state.kind}`, open ? 'bg-neutral-100' : 'hover:bg-neutral-100']">
      <i :class="['status-icon', ICONS[state.kind]]" aria-hidden="true"></i>
      <span class="status-label text-xs font-semibold whitespace-nowrap">{{ state.label }}</span>
      <span v-if="fileName" class="status-file text-xs text-neutral-500 truncate min-w-0">{{ fileName }}</span>
      <i class="fa-solid fa-chevron-down text-[10px] text-neutral-400 shrink-0" aria-hidden="true"></i>
    </button>

    <div v-if="open" role="dialog" aria-label="Stato del salvataggio" @keydown.esc.stop="close"
      class="absolute left-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white border border-neutral-200 rounded-xl shadow-xl p-4 z-50 text-sm text-neutral-800">
      <h3 class="flex items-center gap-2 font-semibold mb-3" :class="`tone-${state.kind}`">
        <i :class="['status-icon', ICONS[state.kind]]" aria-hidden="true"></i> {{ state.label }}
      </h3>

      <dl class="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-[13px] mb-3">
        <template v-for="row in rows" :key="row[0]">
          <dt class="text-neutral-500">{{ row[0] }}</dt>
          <dd class="m-0 [overflow-wrap:anywhere]">{{ row[1] }}</dd>
        </template>
      </dl>

      <p v-if="note" class="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2 mb-3">{{ note }}</p>

      <div class="flex flex-wrap gap-2">
        <button type="button" @click="run(handleSaveFile)"
          class="px-3 py-1.5 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 cursor-pointer">
          Salva Lavoro
        </button>
        <button v-if="canSaveAs" type="button" @click="run(handleSaveAs)"
          class="px-3 py-1.5 text-xs font-semibold rounded-md border border-neutral-200 hover:bg-neutral-50 cursor-pointer">
          Salva con nome…
        </button>
        <button v-if="canReveal" type="button" @click="reveal"
          class="px-3 py-1.5 text-xs font-semibold rounded-md border border-neutral-200 hover:bg-neutral-50 cursor-pointer">
          <i class="fa-regular fa-folder-open" aria-hidden="true"></i> Mostra nella cartella
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { platform } from '../platform'
import { useChessBookStore } from '../stores/chessBookStore'
import { autosaveError, autosavePaused, useBookFileActions } from '../composables/useBookFileActions'
import { saveState, shortFileName, type SaveStateKind } from '../utils/saveState'
import { vClickOutside } from '../directives/clickOutside'
import { vTooltip } from '../directives/tooltip'

const store = useChessBookStore()
const { handleSaveFile, handleSaveAs } = useBookFileActions()
const desktop = platform.capabilities.nativeFiles
const currentFile = computed(() => platform.files.currentFile?.value ?? null)

const ICONS: Record<SaveStateKind, string> = {
  busy: 'fa-solid fa-arrows-rotate fa-spin',
  local: 'fa-solid fa-check',
  file: 'fa-solid fa-check-double',
  'no-file': 'fa-solid fa-triangle-exclamation',
  paused: 'fa-solid fa-triangle-exclamation',
  error: 'fa-solid fa-triangle-exclamation',
}

const state = computed(() => saveState({
  status: store.saveStatus,
  nativeFiles: desktop,
  hasFile: !!currentFile.value,
  fileDirty: store.fileDirty,
  paused: autosavePaused.value,
  error: autosaveError.value,
}))

const fileName = computed(() => currentFile.value ? shortFileName(currentFile.value.name) : '')
const description = computed(() => `${state.value.label}${fileName.value ? ` (${fileName.value})` : ''}: clic per i dettagli`)

// Desktop: il nome del file nel titolo della finestra, con • quando il file non contiene le ultime modifiche
watchEffect(() => {
  if (!desktop) return
  document.title = fileName.value ? `${store.fileDirty ? '• ' : ''}${fileName.value} — MTC Books` : 'MTC Books'
})

// --- Riquadro dei dettagli ---
const open = ref(false)
const folder = ref<string | null>(null)
const close = () => { open.value = false }
const toggle = async () => {
  open.value = !open.value
  if (open.value && desktop) folder.value = await platform.files.currentFolder?.() ?? null
}
const run = (action: () => unknown) => { close(); void action() }
const canSaveAs = !!platform.files.saveBookAs
const canReveal = computed(() => !!platform.files.revealCurrentFile && !!currentFile.value)
const reveal = () => { close(); platform.files.revealCurrentFile?.() }

const time = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null

const rows = computed<[string, string][]>(() => {
  const local = time(store.savedLocallyAt)
  const out: [string, string][] = []
  if (!desktop) {
    out.push(['Copia nel browser', local ? `aggiornata alle ${local}` : 'aggiornata'])
    out.push(['File .mtcbook', store.fileDirty ? 'da aggiornare' : 'aggiornato con l’ultimo «Salva Lavoro»'])
    return out
  }
  const f = currentFile.value
  if (f) {
    out.push(['File', f.name])
    if (folder.value) out.push(['Cartella', folder.value])
    out.push(['Salvato su file', time(f.savedAt) ? `alle ${time(f.savedAt)}` : 'non ancora in questa sessione'])
    out.push(['Salvataggio automatico', autosavePaused.value ? 'sospeso'
      : autosaveError.value ? 'l’ultimo tentativo non è riuscito'
        : store.isLocked ? 'fermo: il libro è in sola lettura' : 'attivo, 30 secondi dopo l’ultima modifica'])
  } else {
    out.push(['File', 'nessuno: il libro è solo nella copia interna'])
  }
  out.push(['Copia interna', local ? `aggiornata alle ${local}` : 'aggiornata'])
  return out
})

const note = computed(() => {
  switch (state.value.kind) {
    case 'paused': return 'Il file è stato modificato da un altro programma: il salvataggio automatico è sospeso. Con «Salva Lavoro» scegli se sovrascriverlo o salvarlo con un altro nome.'
    case 'error': return 'L’ultimo salvataggio automatico non è riuscito: riprova con «Salva Lavoro».'
    case 'no-file': return 'Scegli un file con «Salva Lavoro» per attivare il salvataggio automatico.'
    case 'local': return desktop ? null : 'Il browser può cancellare la sua copia con i dati di navigazione: scarica il file con «Salva Lavoro».'
    default: return null
  }
})
</script>

<style scoped>
.status-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
.tone-local { color: #525252; }
.tone-file { color: #059669; }
.tone-busy, .tone-no-file, .tone-paused, .tone-error { color: #d97706; }
.status-file { max-width: 220px; }

@media (prefers-reduced-motion: reduce) {
  .status-icon.fa-spin { animation: none; }
}
</style>
