// Riordino delle sezioni nella barra laterale con drag & drop; le regole sono in utils/sectionOrder
import { ref, type Ref } from 'vue'
import type { SectionIndexItem } from '../stores/chessBookStore'
import { dropTarget, moveSection } from '../utils/sectionOrder'

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
    if (locked.value || fromIndex === null) return
    moveSection(sections.value, fromIndex, targetIndex)
  }

  // Linea di inserimento solo dove la sezione può andare: sotto se scende (o su copertina e indice), sopra se sale
  const dropClass = (index: number, section: SectionIndexItem): string => {
    const from = draggedIndex.value
    if (activeDropIndex.value !== index || from === null) return ''
    if (dropTarget(sections.value, from, index) === null) return ''
    const below = section.type === 'cover' || section.type === 'index' || from < index
    return below
      ? 'bg-neutral-100 shadow-[inset_0_-2px_0_0_#171717]'
      : 'bg-neutral-100 shadow-[inset_0_2px_0_0_#171717]'
  }

  return { onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd: reset, dropClass }
}
