import { EditorState } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/core'

/**
 * Azzera la cronologia annulla/ripristina: lo stato si ricrea con lo stesso documento e gli stessi plugin.
 * Selezione e marcature attive si conservano: senza, il cursore tornerebbe a inizio documento e
 * il focus successivo (es. dopo l'inserimento di un diagramma che spezza un albero) farebbe scorrere lì la pagina.
 */
export const resetHistory = (ed: Editor) => {
  try {
    const { view } = ed
    const { doc, plugins, selection, storedMarks } = view.state
    view.updateState(EditorState.create({ doc, plugins, selection, storedMarks }))
  } catch (e) {
    console.warn('[editor] Impossibile azzerare la cronologia annulla/ripristina:', e)
    return
  }
  // Riallinea la toolbar: una transazione vuota, a node view già montate
  requestAnimationFrame(() => {
    if (ed.isDestroyed) return
    try {
      ed.view.dispatch(ed.view.state.tr.setMeta('addToHistory', false))
    } catch (e) {
      console.warn('[editor] Riallineamento della toolbar non riuscito:', e)
    }
  })
}