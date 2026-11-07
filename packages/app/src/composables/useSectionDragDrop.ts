// Riordino dei capitoli nella barra laterale con drag & drop (copertina e indice restano in testa)
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

    // Su copertina o indice: il capitolo diventa il primo, subito dopo di loro.
    // Il capitolo trascinato sta già dopo il primo capitolo, quindi toglierlo non sposta quella posizione.
    const finalIndex = target.type === 'chapter'
      ? targetIndex
      : list.findIndex((s) => s.type === 'chapter')

    list.splice(fromIndex, 1)
    list.splice(finalIndex, 0, dragged)
  }

  // Linea di inserimento: sopra se si sale, sotto se si scende; sotto copertina e indice, dove va il capitolo
  const dropClass = (index: number, section: SectionIndexItem): string => {
    if (activeDropIndex.value !== index || draggedIndex.value === null) return ''
    const below = section.type !== 'chapter' || draggedIndex.value < index
    return below
      ? 'bg-neutral-100 shadow-[inset_0_-2px_0_0_#171717]'
      : 'bg-neutral-100 shadow-[inset_0_2px_0_0_#171717]'
  }

  return { onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd: reset, dropClass }
}
