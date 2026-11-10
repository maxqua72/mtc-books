// Colonne laterali aperte o ridotte a una striscia: preferenza del dispositivo, come lo zoom. Non entra nel .mtcbook
import { ref, watch } from 'vue'

const KEY = 'mtc-collapsed-panels'

export type Panel = 'sections' | 'board'

function load(): Record<Panel, boolean> {
  const fallback = { sections: false, board: false }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<Panel, unknown>>
    return { sections: raw.sections === true, board: raw.board === true }
  } catch {
    return fallback
  }
}

/** true = colonna ridotta a striscia. Stato condiviso: lo usano le colonne e il tour */
export const collapsedPanels = ref(load())

watch(collapsedPanels, (value) => {
  try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* vale solo per questa sessione */ }
}, { deep: true })

export const setPanelCollapsed = (panel: Panel, collapsed: boolean) => {
  collapsedPanels.value[panel] = collapsed
}

/** Riapre le colonne ridotte; restituisce true se ne ha riaperta almeno una */
export const expandAllPanels = (): boolean => {
  const { sections, board } = collapsedPanels.value
  collapsedPanels.value = { sections: false, board: false }
  return sections || board
}
