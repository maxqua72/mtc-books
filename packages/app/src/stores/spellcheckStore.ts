import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_SPELLCHECK, type SpellcheckSettings, type SpellcheckSnapshot, type SpellcheckStatus } from '@mtc/shared'
import { platform } from '../platform'

export const useSpellcheckStore = defineStore('spellcheck', () => {
  const settings = ref<SpellcheckSettings>({ ...DEFAULT_SPELLCHECK })
  const status = ref<SpellcheckStatus>({})
  const saveError = ref<string | null>(null)
  let started = false

  const apply = (s: SpellcheckSnapshot) => {
    settings.value = s.settings
    status.value = s.status
  }

  async function init() {
    if (started) return
    started = true
    platform.spellcheck.onStatus?.((s) => { status.value = s })
    try { apply(await platform.spellcheck.load()) } catch (e) { console.error('[Ortografia]', e) }
  }

  async function save(next: SpellcheckSettings) {
    try {
      apply(await platform.spellcheck.save(next))
      saveError.value = null
    } catch (e) {
      console.error('[Ortografia]', e)
      saveError.value = e instanceof Error ? e.message : String(e)
    }
  }

  const setEnabled = (enabled: boolean) => save({ ...settings.value, enabled })

  /** Resta sempre almeno una lingua */
  function toggleLanguage(code: string) {
    const { languages } = settings.value
    const next = languages.includes(code) ? languages.filter((l) => l !== code) : [...languages, code]
    return next.length ? save({ ...settings.value, languages: next }) : Promise.resolve()
  }

  const message = computed(() => {
    if (saveError.value) return `Impossibile salvare la scelta: ${saveError.value}`
    if (!settings.value.enabled) return null
    const states = Object.values(status.value)
    if (states.includes('failed')) return 'Download del dizionario non riuscito: controlla la connessione e riattiva il controllo.'
    if (states.includes('downloading')) return 'Download del dizionario in corso…'
    return states.length ? 'Dizionario pronto.' : null
  })

  return { settings, message, init, setEnabled, toggleLanguage }
})
