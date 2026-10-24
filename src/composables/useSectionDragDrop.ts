// Riordino dei capitoli nella barra laterale con drag & drop (la copertina resta in testa, l'indice in coda)
import { ref, type Ref } from 'vue'
import type { SectionIndexItem } from '../stores/chessBookStore'

export function useSectionDragDrop(sections: Ref<SectionIndexItem[]>, locked: Ref<boolean>) {
  const draggedIndex = ref<number | null>(null)
  const activeDropIndex = ref<number | null>(null)

  const reset = () => {
    draggedIndex.value = null
    activeDropIndex.value = null
  }

  const onDragStart = (index: number) => {
    if (locked.value) return
    draggedIndex.value = index
  }

  // Feedback visivo solo se si passa sopra una voce diversa da quella trascinata
  const onDragOver = (index: number) => {
    if (draggedIndex.value !== null && draggedIndex.value !== index) activeDropIndex.value = index
  }

  const onDragLeave = (index: number) => {
    if (activeDropIndex.value === index) activeDropIndex.value = null
  }

  const onDrop = (targetIndex: number) => {
    const fromIndex = draggedIndex.value
    reset()
    if (locked.value || fromIndex === null || fromIndex === targetIndex) return

    const list = sections.value
    const dragged = list[fromIndex]
    const target = list[targetIndex]
    if (dragged.type !== 'chapter') return
    if (target.type === 'cover') return

    // Sull'Indice: il capitolo si ferma subito prima
    let finalIndex = targetIndex
    if (target.type === 'index' && fromIndex < targetIndex) finalIndex = targetIndex - 1

    list.splice(fromIndex, 1)
    list.splice(finalIndex, 0, dragged)
  }

  // Linea di inserimento: sopra se si sale, sotto se si scende, sempre sopra sull'Indice
  const dropClass = (index: number, section: SectionIndexItem): string => {
    if (activeDropIndex.value !== index || draggedIndex.value === null) return ''
    if (section.type === 'cover') return ''
    const movingDown = draggedIndex.value < index && section.type === 'chapter'
    return movingDown
      ? 'bg-neutral-100 shadow-[inset_0_-2px_0_0_#171717]'
      : 'bg-neutral-100 shadow-[inset_0_2px_0_0_#171717]'
  }

  return { onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd: reset, dropClass }
}
