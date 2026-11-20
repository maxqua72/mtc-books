// Colonne laterali aperte o ridotte a una striscia: preferenza del dispositivo, come lo zoom. Non entra nel .mtcbook.
// Con la finestra stretta le colonne si riducono da sole (prima le sezioni, poi la scacchiera), così il foglio
// resta leggibile; la preferenza salvata non cambia e torna valida quando la finestra si allarga.
import { computed, ref, watch } from 'vue'

const KEY = 'mtc-collapsed-panels'

export type Panel = 'sections' | 'board'
type PanelFlags = Record<Panel, boolean>

/** Sotto queste larghezze della finestra (px) la colonna si riduce da sola */
export const AUTO_COLLAPSE_BELOW: Record<Panel, number> = { sections: 1200, board: 860 }

/** Colonne da ridurre per la larghezza della finestra */
export const autoCollapsedFor = (width: number): PanelFlags => ({
  sections: width < AUTO_COLLAPSE_BELOW.sections,
  board: width < AUTO_COLLAPSE_BELOW.board,
})

/**
 * Stato effettivo: una scelta fatta mentre la colonna è ridotta in automatico (override) vale finché la
 * finestra non torna sopra o sotto la soglia; altrimenti la colonna è ridotta per preferenza o per larghezza.
 */
export const effectiveCollapsed = (pref: PanelFlags, override: Record<Panel, boolean | null>, auto: PanelFlags): PanelFlags => ({
  sections: override.sections ?? (pref.sections || auto.sections),
  board: override.board ?? (pref.board || auto.board),
})

function load(): PanelFlags {
  const fallback = { sections: false, board: false }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<Panel, unknown>>
    return { sections: raw.sections === true, board: raw.board === true }
  } catch {
    return fallback
  }
}

const preference = ref<PanelFlags>(load())
const override = ref<Record<Panel, boolean | null>>({ sections: null, board: null })
const windowWidth = ref(typeof window === 'undefined' ? 1920 : window.innerWidth)
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { windowWidth.value = window.innerWidth })
}
const auto = computed(() => autoCollapsedFor(windowWidth.value))

// Superata una soglia la scelta temporanea non vale più: decide di nuovo la larghezza
watch(() => auto.value.sections, () => { override.value.sections = null })
watch(() => auto.value.board, () => { override.value.board = null })

watch(preference, (value) => {
  try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* vale solo per questa sessione */ }
}, { deep: true })

/** true = colonna ridotta a striscia. Stato condiviso: lo usano le colonne e il tour */
export const collapsedPanels = computed(() => effectiveCollapsed(preference.value, override.value, auto.value))

/** Con la colonna ridotta per la larghezza, aprirla o chiuderla vale per ora e non cambia la preferenza salvata */
export const setPanelCollapsed = (panel: Panel, collapsed: boolean) => {
  if (auto.value[panel]) {
    override.value[panel] = collapsed
  } else {
    preference.value[panel] = collapsed
    override.value[panel] = null
  }
}

/** Riapre le colonne ridotte; restituisce true se ne ha riaperta almeno una */
export const expandAllPanels = (): boolean => {
  const { sections, board } = collapsedPanels.value
  setPanelCollapsed('sections', false)
  setPanelCollapsed('board', false)
  return sections || board
}
