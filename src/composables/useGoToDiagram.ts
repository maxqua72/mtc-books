import { nextTick } from 'vue'
import type { Editor } from '@tiptap/core'
import { useChessBookStore } from '../stores/chessBookStore'

const raf = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

const findDiagramPos = (editor: Editor, id: string): number | null => {
  let found: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false
    if (node.type.name === 'chessDiagram' && node.attrs.id === id) {
      found = pos
      return false
    }
  })
  return found
}

/** Porta in vista il diagramma, cambiando capitolo se serve */
export async function goToDiagram(editor: Editor, id: string) {
  const store = useChessBookStore()
  const target = store.diagramLabels.get(id)
  if (!target) return

  if (store.activeSectionId !== target.sectionId) {
    window.dispatchEvent(new CustomEvent('request-editor-sync'))
    await store.changeActiveSection(target.sectionId, store.activeSectionHtml)
    await nextTick()
    await raf()
    await raf()
  }

  const pos = findDiagramPos(editor, id)
  if (pos === null) return
  const dom = editor.view.nodeDOM(pos) as HTMLElement | null
  if (!dom) return

  dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
  dom.classList.add('diagram-flash')
  setTimeout(() => dom.classList.remove('diagram-flash'), 1600)
}

/** Da chi non ha l'editor (i commenti delle mosse) */
export const requestGoToDiagram = (id: string) =>
  window.dispatchEvent(new CustomEvent('go-to-diagram', { detail: { id } }))