// Zoom dell'editor: preferenza del dispositivo, non del libro. Non entra nel .mtcbook e non cambia il PDF
const KEY = 'mtc-editor-zoom'
export const ZOOM_OPTIONS = ['fit-width', '50', '75', '100', '125', '150'] as const
const DEFAULT_ZOOM = '100'

export const cleanZoom = (value: string | null): string =>
  ZOOM_OPTIONS.some((option) => option === value) ? value! : DEFAULT_ZOOM

export function loadZoom(): string {
  try { return cleanZoom(localStorage.getItem(KEY)) } catch { return DEFAULT_ZOOM }
}

export function saveZoom(value: string) {
  try { localStorage.setItem(KEY, value) } catch { /* vale solo per questa sessione */ }
}
