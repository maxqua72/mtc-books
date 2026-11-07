<template>
  <BaseModal :is-open="isOpen" width-class="max-w-lg" labelledby="settings-title" @close="emit('close')">

        <div class="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h3 id="settings-title" class="text-lg font-semibold text-neutral-900">Impostazioni</h3>
          <button @click="emit('close')" aria-label="Chiudi"
            class="text-neutral-400 hover:text-neutral-700 transition p-1 rounded-md hover:bg-neutral-100">✕</button>
        </div>

        <div class="px-6 py-5 grid grid-cols-2 gap-3">
          <label v-for="t in THEMES" :key="t.id"
            class="block rounded-lg border-2 p-3 cursor-pointer transition"
            :class="store.theme === t.id ? 'border-neutral-900' : 'border-neutral-200 hover:border-neutral-400'">
            <div class="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <input type="radio" name="app-theme" :value="t.id" :checked="store.theme === t.id"
                @change="store.setTheme(t.id)" />
              {{ t.title }}
            </div>
            <p class="text-xs text-neutral-500 mt-1 mb-2">{{ t.description }}</p>

            <!-- Anteprima: ogni riquadro porta il proprio data-theme, quindi mostra i colori di quel tema -->
            <div class="pv" :data-theme="t.id" aria-hidden="true">
              <div class="pv-header"></div>
              <div class="pv-body">
                <div class="pv-left"></div>
                <div class="pv-main">
                  <div class="pv-toolbar"></div>
                  <div class="pv-desk"><div class="pv-sheet"><span></span></div></div>
                </div>
                <div class="pv-right"></div>
              </div>
            </div>
          </label>
        </div>

        <section class="border-t border-neutral-200 px-6 py-4 space-y-2" aria-labelledby="spellcheck-title">
          <div class="flex items-center justify-between gap-3">
            <h4 id="spellcheck-title" class="text-sm font-semibold text-neutral-900">Controllo ortografico</h4>
            <label class="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
              <input type="checkbox" :checked="spellcheck.settings.enabled" @change="onEnabled" />
              Attivo
            </label>
          </div>

          <fieldset v-if="capabilities.spellcheckLanguages" class="flex flex-wrap gap-x-4 gap-y-1" aria-label="Lingue">
            <label v-for="l in SPELLCHECK_LANGUAGES" :key="l.code" class="flex items-center gap-1.5 text-xs text-neutral-700">
              <input type="checkbox" :checked="spellcheck.settings.languages.includes(l.code)"
                :disabled="spellcheck.settings.languages.length === 1 && spellcheck.settings.languages[0] === l.code"
                @change="onLanguage($event, l.code)" />
              {{ l.label }}
            </label>
          </fieldset>

          <p class="text-[11px] text-neutral-500 leading-snug">
            <template v-if="capabilities.spellcheckLanguages">
              Alla prima attivazione viene scaricato il dizionario di ogni lingua scelta. Il testo del libro non lascia il computer.
            </template>
            <template v-else>
              Il controllo usa le lingue e i dizionari del browser. Se le parole errate non vengono sottolineate,
              attiva il controllo ortografico e la lingua del libro nelle impostazioni del browser.
            </template>
          </p>
          <p v-if="spellcheck.message" class="text-[11px] text-neutral-700 font-medium" aria-live="polite">{{ spellcheck.message }}</p>
        </section>

        <section class="border-t border-neutral-200 px-6 py-4 flex items-center justify-between gap-3" aria-labelledby="tour-title">
          <div>
            <h4 id="tour-title" class="text-sm font-semibold text-neutral-900">Tour di benvenuto</h4>
            <p class="text-[11px] text-neutral-500 leading-snug">
              {{ bookStore.isBookLoaded ? 'Mostra di nuovo i comandi principali, uno alla volta.' : 'Apri o crea un libro per vedere il tour.' }}
            </p>
          </div>
          <button type="button" @click="onTour" :disabled="!bookStore.isBookLoaded"
            class="shrink-0 px-3 py-1.5 text-xs font-semibold border border-neutral-300 rounded-lg hover:bg-neutral-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
            Rivedi il tour
          </button>
        </section>

        <div class="border-t border-neutral-200 px-6 py-3 flex items-center gap-3">
          <p class="flex-1 text-[11px] text-neutral-500 leading-snug">
            Queste scelte restano su questo dispositivo: non finiscono nel file .mtcbook e non cambiano il PDF.
            <button type="button" @click="openManualPage('privacy')" class="underline hover:text-neutral-900 cursor-pointer">Privacy</button>
          </p>
          <button @click="emit('close')"
            class="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition">
            Chiudi
          </button>
        </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { SPELLCHECK_LANGUAGES } from '@mtc/shared'
import { THEMES, useThemeStore } from '../stores/themeStore'
import { useSpellcheckStore } from '../stores/spellcheckStore'
import { capabilities } from '../platform'
import BaseModal from './BaseModal.vue'
import { openManualPage } from '../utils/manualPage'
import { useChessBookStore } from '../stores/chessBookStore'
import { startTour } from '../composables/useOnboardingTour'

defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useThemeStore()
const spellcheck = useSpellcheckStore()
const bookStore = useChessBookStore()

// Prima si chiude la finestra: il tour deve vedere i comandi, non coperti dalle impostazioni
async function onTour() {
  emit('close')
  await new Promise((r) => setTimeout(r, 150))
  await startTour()
}

// La casella mostra sempre lo stato salvato: se il salvataggio fallisce torna com'era
async function onEnabled(event: Event) {
  const box = event.target as HTMLInputElement
  await spellcheck.setEnabled(box.checked)
  box.checked = spellcheck.settings.enabled
}

async function onLanguage(event: Event, code: string) {
  await spellcheck.toggleLanguage(code)
  ;(event.target as HTMLInputElement).checked = spellcheck.settings.languages.includes(code)
}
</script>

<style scoped>
/* Mini-schermata: le variabili --t-* arrivano dal data-theme del riquadro (vedi theme.css) */
.pv {
  display: flex;
  flex-direction: column;
  aspect-ratio: 16 / 10;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  overflow: hidden;
}
.pv-header { height: 12%; background: var(--t-header-bg); border-bottom: 1px solid var(--t-surface-border); }
.pv-body { flex: 1; display: flex; min-height: 0; }
.pv-left { width: 20%; background: var(--t-left-bg); border-right: 1px solid var(--t-surface-border); }
.pv-right { width: 24%; background: var(--t-right-bg); border-left: 1px solid var(--t-surface-border); }
.pv-main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--t-main-bg); }
.pv-toolbar { height: 14%; background: var(--t-toolbar-bg); border-bottom: 1px solid var(--t-surface-border); }
.pv-desk { flex: 1; display: flex; justify-content: center; padding: 6% 12% 0; background: var(--t-desk-bg); }
.pv-sheet { width: 100%; background: var(--t-sheet-bg); padding: 8% 10%; }
.pv-sheet span { display: block; height: 4px; width: 55%; border-radius: 2px; background: var(--t-accent); }
</style>
