// Dove finisce un nuovo albero: posizione, descrizione, riquadro tratteggiato, richieste di inserimento
import { nextTick, watch, type ShallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { usePgnImportStore, type PgnPlacement } from '../stores/pgnImportStore'
import { findTreeBlockPos } from '../utils/editorDoc'

type EditorRef = ShallowRef<Editor | undefined>

export function useTreePlacement(editor: EditorRef) {
  const store = useChessBookStore()
  const treeStore = useChessTreeStore()
  const pgnStore = usePgnImportStore()

  // Posizione (tra due blocchi di primo livello) in cui verrebbe inserito il nuovo blocco
  const resolveInsertPos = (placement: PgnPlacement): number | null => {
    const ed = editor.value
    if (!ed) return null
    const { doc, selection } = ed.state

    if (placement === 'end') return doc.content.size
    if (placement === 'cursor') {
      const $to = selection.$to
      return $to.depth >= 1 ? $to.after(1) : selection.to   // mai dentro un paragrafo
    }
    const id = treeStore.activeTreeId
    const block = id ? findTreeBlockPos(doc, id) : null
    return block ? block.pos + block.size : null
  }

  const describePlacement = (placement: PgnPlacement): string => {
    const ed = editor.value
    if (!ed) return ''
    if (placement === 'end') return 'in fondo al capitolo'
    if (placement === 'after-active') {
      const tree = treeStore.currentTree
      return tree ? `subito dopo il blocco «${tree.title}»` : ''
    }
    const pos = resolveInsertPos('cursor')
    if (pos === null) return 'alla posizione del cursore'
    const before = ed.state.doc.resolve(pos).nodeBefore
    if (!before) return 'all’inizio del capitolo'
    const text = before.textContent.trim()
    if (!text) return 'dopo l’elemento precedente (diagramma o partita)'
    return `dopo il paragrafo «${text.length > 50 ? text.slice(0, 50) + '…' : text}»`
  }

  pgnStore.registerPlacementApi({ resolve: resolveInsertPos, describe: describePlacement })

  // Riquadro tratteggiato nel punto di inserimento (solo con pannello aperto e "nuovo blocco")
  const syncPgnMarker = () => {
    const ed = editor.value
    if (!ed) return
    const pos = pgnStore.isOpen && pgnStore.mode === 'new-tree'
      ? resolveInsertPos(pgnStore.placement)
      : null
    ed.commands.setPgnInsertMarker(pos)
  }
  watch(
    () => [pgnStore.isOpen, pgnStore.mode, pgnStore.placement, treeStore.activeTreeId],
    syncPgnMarker
  )
  watch(() => store.activeSectionId, () => nextTick(syncPgnMarker))

  // Il marcatore segue il cursore quando si sceglie "dopo il cursore"
  watch(editor, (ed) => {
    if (!ed) return
    ed.on('selectionUpdate', () => {
      if (!pgnStore.isOpen) return
      pgnStore.touchSelection()
      syncPgnMarker()
    })
  }, { immediate: true })

  const revealTreeBlock = (treeId: string) => {
    const ed = editor.value
    const block = ed ? findTreeBlockPos(ed.state.doc, treeId) : null
    if (!ed || !block) return
    const dom = ed.view.nodeDOM(block.pos) as HTMLElement | null
    if (!dom) return
    dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
    dom.classList.add('diagram-flash')
    setTimeout(() => dom.classList.remove('diagram-flash'), 1600)
  }

  // Richieste di inserimento: tutti i blocchi in una sola transazione (un solo Ctrl+Z annulla tutto)
  watch(() => pgnStore.request, async (req) => {
    const ed = editor.value
    if (!req || !ed) return

    if (req.insert) {
      const size = ed.state.doc.content.size
      const pos = req.pos ?? size
      const atEnd = pos >= size
      ed.chain().insertContentAt(pos, [
        ...req.treeIds.map(id => ({ type: 'chessTreeBlock', attrs: { treeId: id } })),
        // in fondo al documento serve un paragrafo per poter continuare a scrivere
        ...(atEnd ? [{ type: 'paragraph' }] : [])
      ]).run()
    }

    await nextTick()
    revealTreeBlock(req.treeIds[0])
  })
}
