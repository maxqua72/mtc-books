// Gli alberi copiati o tagliati vivono nello store (chessTreeStore.clipboard): negli appunti di
// sistema non si può mettere un oggetto, ma solo testo. Alla copia si scrive qui un segnaposto,
// così Ctrl+V nell'editor riconosce che l'ultima operazione è stata su un albero. Se negli appunti
// c'è altro testo (copiato dopo), Ctrl+V resta un normale incolla.

export const TREE_CLIP_MARKER = 'mtc-albero-di-mosse'

export const isTreeClipMarker = (text: string): boolean => text.trim() === TREE_CLIP_MARKER

/** Può fallire (permessi del browser, contesto non sicuro): in tal caso resta il pulsante "Incolla albero" */
export async function writeTreeClipMarker(): Promise<void> {
  try {
    await navigator.clipboard.writeText(TREE_CLIP_MARKER)
  } catch (err) {
    console.warn('[treeClipboard] Impossibile scrivere negli appunti di sistema:', err)
  }
}
