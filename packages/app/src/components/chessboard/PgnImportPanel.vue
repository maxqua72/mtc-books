<template>
  <div class="space-y-3">
    <p v-if="!canUse" class="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
      {{ locked
        ? 'Documento in sola lettura: abilita le modifiche dall’intestazione per importare un PGN.'
        : 'Apri un capitolo o una sezione di testo per importare un PGN: copertina e indice non contengono alberi di mosse.' }}
    </p>

    <template v-else>
      <PgnSourceInput v-model="text" :error="fileError || parsed.error" @file="loadFile" @clear="clearSource(false)" />

      <PgnGameList v-if="parsed.games.length" v-model:selected="selectedIdx" :games="parsed.games"
        :selected-count="selectedGames.length" :all-selected="allSelected" :empty-count="parsed.empty"
        :previews="previews" :single-preview="singlePreview" @toggle-all="toggleAll" />

      <PgnDestinationPicker v-if="selectedGames.length" v-model:mode="pgn.mode" v-model:placement="pgn.placement"
        :selected-count="selectedGames.length" :after-active-available="afterActiveAvailable"
        :placement-label="placementLabel" :into-active-reason="intoActiveReason" :into-active-text="intoActiveText" />

      <!-- Diagrammi indicati nel PGN ([#] di ChessBase, simbolo D di Scid): solo per i nuovi alberi -->
      <label v-if="pgn.mode === 'new-tree' && markedDiagrams > 0"
        class="flex items-center gap-2 text-[11px] text-neutral-700 cursor-pointer select-none">
        <input type="checkbox" v-model="pgn.createDiagrams" class="rounded border-neutral-300 h-3.5 w-3.5" />
        {{ markedDiagrams === 1 ? 'Crea il diagramma indicato nel PGN' : `Crea i ${markedDiagrams} diagrammi indicati nel PGN` }}
      </label>

      <button @click="importNow" :disabled="!canImport" v-tooltip.desc="importTitle"
        class="w-full py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white disabled:bg-neutral-200 disabled:text-neutral-400 font-medium rounded text-xs transition">
        Importa nel documento
      </button>
      <p v-if="result" class="text-[11px]" :class="result.ok ? 'text-green-700' : 'text-red-600'">
        {{ result.message }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePgnImportForm } from '../../composables/usePgnImportForm'
import PgnSourceInput from './pgn/PgnSourceInput.vue'
import PgnGameList from './pgn/PgnGameList.vue'
import PgnDestinationPicker from './pgn/PgnDestinationPicker.vue'
import { vTooltip } from '../../directives/tooltip'
import { useNoticeStore } from '../../stores/noticeStore'

const {
  pgn, locked, canUse,
  text, fileError, parsed, selectedIdx, result, clearSource, loadFile,
  selectedGames, allSelected, toggleAll, previews, singlePreview,
  afterActiveAvailable, placementLabel, intoActiveReason, intoActiveText,
  canImport, doImport,
} = usePgnImportForm()

const emit = defineEmits<{ (e: 'imported'): void }>()
const notices = useNoticeStore()

// Riuscita: l'esito va nell'avviso in basso e la console torna alla scheda FEN. Fallita: l'errore resta qui
const importNow = () => {
  const outcome = doImport()
  if (!outcome?.ok) return
  notices.show({ message: outcome.message })
  emit('imported')
}

// Diagrammi marcati nelle partite selezionate (dalle statistiche già calcolate per l'elenco)
const markedDiagrams = computed(() => selectedGames.value.reduce((sum, g) =>
  sum + ((previews.value.get(g.index) ?? (selectedGames.value.length === 1 ? singlePreview.value : null))?.diagrams ?? 0), 0))

// Solo quando il pulsante è disattivato: con le scelte fatte, cosa succede è già scritto sopra
const importTitle = computed(() => canImport.value ? null
  : !selectedGames.value.length ? 'Incolla un PGN o carica un file, poi seleziona almeno una partita'
    : intoActiveReason.value)
</script>
