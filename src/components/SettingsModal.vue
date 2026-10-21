<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 font-sans"
      @mousedown.self="emit('close')">
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title"
        class="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-lg flex flex-col overflow-hidden">

        <div class="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h3 id="settings-title" class="text-lg font-semibold text-neutral-900">Impostazioni · Aspetto</h3>
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

        <div class="border-t border-neutral-200 px-6 py-3 flex items-center gap-3">
          <p class="flex-1 text-[11px] text-neutral-500 leading-snug">
            La scelta resta in questo browser: non finisce nel file .mtcbook e non cambia il PDF.
          </p>
          <button @click="emit('close')"
            class="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { THEMES, useThemeStore } from '../stores/themeStore'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useThemeStore()

const onKeydown = (e: KeyboardEvent) => {
  if (props.isOpen && e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
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
