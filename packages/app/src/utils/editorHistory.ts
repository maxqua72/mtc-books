import { EditorState } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/core'

/** Azzera la cronologia annulla/ripristina: lo stato si ricrea con lo stesso documento e gli stessi plugin */
export const resetHistory = (ed: Editor) => {
  try {
    const { view } = ed
    view.updateState(EditorState.create({ doc: view.state.doc, plugins: view.state.plugins }))
  } catch (e) {
    console.warn('[editor] Impossibile azzerare la cronologia annulla/ripristina:', e)
    return
  }
  // Riallinea la toolbar a node view già montate (vedi il commento originale in useBookEditor)
  requestAnimationFrame(() => {
    if (ed.isDestroyed) return
    try {
      ed.view.dispatch(ed.view.state.tr.setMeta('addToHistory', false))
    } catch (e) {
      console.warn('[editor] Riallineamento della toolbar non riuscito:', e)
    }
  })
}