import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSetting, putSetting } from '../db'

// I colori dei temi stanno solo in src/assets/styles/theme.css.
// Per aggiungere un tema: un nuovo blocco [data-theme="..."] nel CSS e una riga in THEMES.
export type ThemeId = 'standard' | 'alt' | 'paper'

export const THEMES: { id: ThemeId; title: string; description: string }[] = [
  { id: 'standard', title: 'Tema standard', description: 'Lo stile originale dell’applicazione.' },
  { id: 'alt', title: 'Tema scuro', description: 'Interfaccia scura, con il foglio sempre chiaro.' },
  { id: 'paper', title: 'Tema carta', description: 'Interfaccia calda, stile carta.' },
]

const SETTING_ID = 'theme'
const DEFAULT_THEME: ThemeId = 'standard'

const isThemeId = (value: unknown): value is ThemeId => THEMES.some(t => t.id === value)

/**
 * Tema dell'interfaccia. Si salva in IndexedDB (tabella `settings`) e solo lì:
 * non fa parte del libro (.mtcbook) e non influisce sull'esportazione PDF.
 */
export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeId>(DEFAULT_THEME)

  const apply = () => { document.documentElement.dataset.theme = theme.value }

  /** Da chiamare all'avvio, prima di montare l'app. Non lancia mai: in caso di errore resta il tema standard. */
  async function init() {
    try {
      const raw = await getSetting(SETTING_ID)
      const saved = raw && typeof raw === 'object' ? (raw as { theme?: unknown }).theme : null
      if (isThemeId(saved)) theme.value = saved
    } catch (e) {
      console.error('[theme] Impossibile leggere le impostazioni:', e)
    }
    apply()
  }

  async function setTheme(id: ThemeId) {
    if (!isThemeId(id)) return
    theme.value = id
    apply()
    try {
      await putSetting(SETTING_ID, { version: 1, theme: id })
    } catch (e) {
      console.error('[theme] Impossibile salvare le impostazioni:', e)
    }
  }

  return { theme, init, setTheme }
})
