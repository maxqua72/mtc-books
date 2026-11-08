// Quale interfaccia aprire: il Taccuino (telefono) o l'editor completo del libro
export const NOTEBOOK_HASH = '#/taccuino'
export const EDITOR_HASH = '#/editor'

/**
 * - `#/taccuino` apre sempre il Taccuino (anche nell'app desktop: serve agli screenshot del manuale)
 * - `#/editor` apre sempre l'editor
 * - senza indicazioni: Taccuino su uno schermo stretto con il tocco (telefono); l'app desktop apre l'editor
 */
export function shouldOpenNotebook(isDesktopApp: boolean, hash = location.hash): boolean {
  if (hash.startsWith(NOTEBOOK_HASH)) return true
  if (hash.startsWith(EDITOR_HASH) || isDesktopApp) return false
  return window.matchMedia?.('(max-width: 767px) and (pointer: coarse)').matches ?? false
}
