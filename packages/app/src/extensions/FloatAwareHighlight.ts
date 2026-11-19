import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

/**
 * Evidenziazione accanto ai diagrammi a margine.
 *
 * Il diagramma a sinistra o a destra è un float: il paragrafo accanto occupa comunque tutta la larghezza
 * del foglio e solo le sue righe si accorciano. Barra e sfondo del blocco selezionato (paragrafo, titolo,
 * albero) finirebbero sotto il diagramma. Qui si misura quanta parte del blocco sta accanto a un diagramma
 * e la si passa al CSS con una decoration (classe .beside-float e variabili --bf-*): il CSS disegna barra
 * e sfondo in due parti, accanto al diagramma (spostate o accorciate) e sotto (nella posizione normale).
 * Solo editor: il PDF non ha evidenziazioni.
 */

const key = new PluginKey<State>('floatAwareHighlight')
export const BESIDE_FLOAT = 'beside-float'

/** Stile della decoration per un NodeView (null = il blocco non sta accanto a un diagramma) */
export function besideFloatStyle(decorations: readonly { spec: { besideFloat?: string } }[]): string | null {
  return decorations.find(d => d.spec.besideFloat)?.spec.besideFloat ?? null
}
const TARGET_TYPES = new Set(['paragraph', 'heading', 'chessTreeBlock'])

interface Inset { left: number; right: number; height: number }

/** Blocchi accanto a un diagramma a margine, per posizione nel documento */
function measure(view: EditorView): Map<number, { size: number; inset: Inset }> {
  const found = new Map<number, { size: number; inset: Inset }>()
  const floats: { rect: DOMRect; isLeft: boolean; textEdge: number }[] = []
  const blocks: { pos: number; size: number; dom: HTMLElement }[] = []

  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'chessDiagram') {
      const dom = view.nodeDOM(pos)
      const align = dom instanceof HTMLElement ? dom.getAttribute('data-align') : null
      if (dom instanceof HTMLElement && (align === 'left' || align === 'right')) {
        const rect = dom.getBoundingClientRect()
        const cs = getComputedStyle(dom)
        const scale = rect.width / (dom.offsetWidth || 1) || 1
        const isLeft = align === 'left'
        // Bordo da cui parte il testo accanto: lato del diagramma più il suo margine verso il testo
        const textEdge = isLeft ? rect.right + parseFloat(cs.marginRight) * scale : rect.left - parseFloat(cs.marginLeft) * scale
        floats.push({ rect, isLeft, textEdge })
      }
      return false
    }
    if (TARGET_TYPES.has(node.type.name)) {
      const dom = view.nodeDOM(pos)
      if (dom instanceof HTMLElement) blocks.push({ pos, size: node.nodeSize, dom })
      return false
    }
    return true   // scende in elenchi e citazioni
  })
  if (!floats.length) return found

  for (const { pos, size, dom } of blocks) {
    const br = dom.getBoundingClientRect()
    // Lo zoom dell'editor è una trasformazione: le misure sullo schermo vanno riportate in px del foglio
    const scale = br.width / (dom.offsetWidth || 1) || 1
    const cs = getComputedStyle(dom)
    const padL = (parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)) * scale
    const padR = (parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth)) * scale
    let inset: Inset | null = null
    for (const f of floats) {
      if (br.top >= f.rect.bottom || br.bottom <= f.rect.top) continue
      // Il blocco deve stare davvero accanto (stessa colonna), non solo alla stessa altezza
      if (f.isLeft ? br.right <= f.rect.right : br.left >= f.rect.left) continue
      inset ??= { left: 0, right: 0, height: 0 }
      if (f.isLeft) inset.left = Math.max(inset.left, (f.textEdge - br.left - padL) / scale)
      else inset.right = Math.max(inset.right, (br.right - f.textEdge - padR) / scale)
      inset.height = Math.max(inset.height, (Math.min(f.rect.bottom, br.bottom) - br.top) / scale)
    }
    if (inset && inset.height > 0) found.set(pos, { size, inset })
  }
  return found
}

const px = (n: number) => `${Math.max(0, n).toFixed(1)}px`

// sig: le misure in forma di testo. Se non cambiano non si crea una transazione,
// così misura e aggiornamento non si rincorrono
interface State { set: DecorationSet; sig: string }

function measured(view: EditorView): State {
  const entries = [...measure(view)].map(([pos, { size, inset }]) => ({
    pos, size,
    style: `--bf-left: ${px(inset.left)}; --bf-right: ${px(inset.right)}; --bf-h: ${px(inset.height)}`,
  }))
  // La spec ripete lo stile: i NodeView Vue (blocco albero) lo legano nel template, altrimenti Vue
  // riscrivendo le proprie classi cancellerebbe quelle messe da ProseMirror
  const decos = entries.map(e => Decoration.node(e.pos, e.pos + e.size, { class: BESIDE_FLOAT, style: e.style }, { besideFloat: e.style }))
  return {
    set: DecorationSet.create(view.state.doc, decos),
    sig: entries.map(e => `${e.pos}:${e.size}:${e.style}`).join('|'),
  }
}

export const FloatAwareHighlight = Extension.create({
  name: 'floatAwareHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<State>({
        key,
        state: {
          init: () => ({ set: DecorationSet.empty, sig: '' }),
          apply: (tr, old) => {
            const next = tr.getMeta(key) as State | undefined
            if (next) return next
            // Documento cambiato: le decoration seguono il testo, la firma no (la prossima misura le riallinea)
            return tr.docChanged ? { set: old.set.map(tr.mapping, tr.doc), sig: '' } : old
          },
        },
        props: { decorations: (state) => key.getState(state)?.set },
        view(view) {
          let timer: ReturnType<typeof setTimeout> | undefined
          // Una sola misura per raffica di aggiornamenti, dopo il rendering dei NodeView: la digitazione non rallenta
          const schedule = () => {
            if (timer) return
            timer = setTimeout(() => {
              timer = undefined
              if (view.isDestroyed) return
              watchBlocks()
              const next = measured(view)
              if (next.sig === key.getState(view.state)?.sig) return
              view.dispatch(view.state.tr.setMeta(key, next).setMeta('addToHistory', false))
            }, 30)
          }
          const resize = new ResizeObserver(schedule)
          resize.observe(view.dom)
          // Anche i singoli blocchi: un albero cresce con le mosse dalla scacchiera, senza transazioni dell'editor.
          // Solo i blocchi nuovi: observe() segnala subito l'elemento, osservarli tutti ogni volta non finirebbe mai
          let watched = new Set<Element>()
          const watchBlocks = () => {
            const now = new Set(view.dom.children)
            for (const el of watched) if (!now.has(el)) resize.unobserve(el)
            for (const el of now) if (!watched.has(el)) resize.observe(el)
            watched = now
          }
          void document.fonts?.ready.then(schedule)
          schedule()
          return {
            update: schedule,
            destroy() {
              clearTimeout(timer)
              resize.disconnect()
            },
          }
        },
      }),
    ]
  },
})
