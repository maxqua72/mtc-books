// Zoom del foglio nell'editor: percentuali fisse oppure "adatta larghezza"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { getPagePx } from '../utils/pageFormats'

export function useEditorZoom(scrollContainer: Ref<HTMLElement | null>) {
  const store = useChessBookStore()

  const zoomOption = ref<string>('100')
  const zoomScale = ref(1)
  let resizeObserver: ResizeObserver | null = null

  const pagePx = computed(() => getPagePx(store.metadata.pageFormat))

  const calculateZoom = () => {
    if (zoomOption.value !== 'fit-width') {
      zoomScale.value = parseFloat(zoomOption.value) / 100
      return
    }
    if (!scrollContainer.value) return

    // clientWidth esclude la barra di scorrimento verticale
    const padding = 64 // margine di sicurezza
    const availableWidth = scrollContainer.value.clientWidth - padding
    if (availableWidth > 0) {
      zoomScale.value = Math.max(0.35, Math.min(2.5, availableWidth / pagePx.value.width))
    }
  }

  const setZoom = (value: string) => {
    zoomOption.value = value
    nextTick(calculateZoom)
  }

  watch(() => store.metadata.pageFormat, calculateZoom)

  // Il foglio scalato con transform occupa ancora lo spazio originale: il margine inferiore compensa la differenza
  const wrapperStyle = computed(() => {
    const { width, height } = pagePx.value
    return {
      transform: `scale(${zoomScale.value})`,
      width: `${width}px`,
      marginBottom: `${height * zoomScale.value - height}px`,
    }
  })

  const canvasMinWidth = computed(() => (zoomOption.value === 'fit-width' ? '0px' : 'min-content'))

  onMounted(() => {
    if (scrollContainer.value) {
      resizeObserver = new ResizeObserver(() => {
        if (zoomOption.value === 'fit-width') calculateZoom()
      })
      resizeObserver.observe(scrollContainer.value)
    }
    calculateZoom()
  })

  onBeforeUnmount(() => resizeObserver?.disconnect())

  return { zoomOption, wrapperStyle, canvasMinWidth, setZoom }
}
