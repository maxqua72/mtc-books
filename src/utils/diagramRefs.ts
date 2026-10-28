// Riferimenti ai diagrammi dentro i commenti delle mosse (HTML in un contenteditable, fuori da Tiptap)
export const DIAGRAM_REF_SELECTOR = 'span[data-type="diagram-ref"]'

type Labels = ReadonlyMap<string, { label: string; caption: string }>

/** Riallinea etichetta (es. 1.3), tooltip e stato "orfano" dei riferimenti presenti in `root` */
export function refreshDiagramRefs(root: HTMLElement, labels: Labels) {
  root.querySelectorAll<HTMLElement>(DIAGRAM_REF_SELECTOR).forEach(el => {
    const info = labels.get(el.getAttribute('data-target-id') ?? '')
    const text = info?.label ?? '?'
    if (el.textContent !== text) el.textContent = text
    el.classList.toggle('is-broken', !info)
    el.title = info
      ? `Ctrl+clic per andare al diagramma ${info.label}${info.caption ? ' — ' + info.caption : ''}`
      : 'Diagramma non trovato: il riferimento è orfano'
  })
}

/** Inserisce un riferimento nel commento che ha il cursore. false = il cursore non è in un commento modificabile. */
export function insertDiagramRefInComment(targetId: string, label: string): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)
  const container = range.commonAncestorContainer
  const element = container instanceof Element ? container : container.parentElement
  const host = element?.closest<HTMLElement>('.comment-editable-text')
  if (!host || host.getAttribute('contenteditable') !== 'true') return false

  const span = document.createElement('span')
  span.className = 'diagram-ref'
  span.setAttribute('data-type', 'diagram-ref')
  span.setAttribute('data-target-id', targetId)
  span.setAttribute('contenteditable', 'false')
  span.textContent = label

  const space = document.createTextNode(' ')
  range.deleteContents()
  range.insertNode(space)   // prima lo spazio, poi il riferimento davanti: il cursore finisce dopo entrambi
  range.insertNode(span)
  range.setStartAfter(space)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  return true
}