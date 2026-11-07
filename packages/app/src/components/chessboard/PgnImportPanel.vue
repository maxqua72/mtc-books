<template>
  <div class="space-y-3">
    <p v-if="!canUse" class="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
      {{ locked
        ? 'Documento in sola lettura: abilita le modifiche dall’intestazione per importare un PGN.'
        : 'Apri un capitolo per importare un PGN: gli alberi di mosse stanno nei capitoli.' }}
    </p>

    <template v-else>
      <PgnSourceInput v-model="text" :error="fileError || parsed.error" @file="loadFile" @clear="clearSource(false)" />

      <PgnGameList v-if="parsed.games.length" v-model:selected="selectedIdx" :games="parsed.games"
        :selected-count="selectedGames.length" :all-selected="allSelected" :empty-count="parsed.empty"
        :previews="previews" :single-preview="singlePreview" @toggle-all="toggleAll" />

      <PgnDestinationPicker v-if="selectedGames.length" v-model:mode="pgn.mode" v-model:placement="pgn.placement"
        :selected-count="selectedGames.length" :after-active-available="afterActiveAvailable"
        :placement-label="placementLabel" :into-active-reason="intoActiveReason" :into-active-text="intoActiveText" />

      <button @click="doImport" :disabled="!canImport" v-tooltip.desc="importTitle"
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

const {
  pgn, locked, canUse,
  text, fileError, parsed, selectedIdx, result, clearSource, loadFile,
  selectedGames, allSelected, toggleAll, previews, singlePreview,
  afterActiveAvailable, placementLabel, intoActiveReason, intoActiveText,
  canImport, doImport,
} = usePgnImportForm()

// Solo quando il pulsante è disattivato: con le scelte fatte, cosa succede è già scritto sopra
const importTitle = computed(() => canImport.value ? null
  : !selectedGames.value.length ? 'Incolla un PGN o carica un file, poi seleziona almeno una partita'
    : intoActiveReason.value)
</script>
