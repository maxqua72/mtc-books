// Formato pagina, margini e spaziature del libro: un'unica fonte per l'editor (variabili CSS) e per il PDF
import { computed } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { getPageSizeCss } from '../utils/pageFormats'
import { COLUMN_GAP_MM, columnWidthMm as columnWidth, twoColumnsAvailable } from '../utils/twoColumns'

const clampSpacing = (v: unknown, def: number) => {
  if (v === '' || v === null || v === undefined) return def
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(30, Math.max(0, n)) : def
}

const margin = (v: unknown, def: number) => {
  if (v === '' || v === null || v === undefined) return def
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, n) : def
}

export function usePageLayout() {
  const store = useChessBookStore()

  const pageSize = computed(() => getPageSizeCss(store.metadata.pageFormat))

  const margins = computed(() => ({
    top: margin(store.metadata.pageMarginTop, 25),
    right: margin(store.metadata.pageMarginRight, 20),
    bottom: margin(store.metadata.pageMarginBottom, 25),
    left: margin(store.metadata.pageMarginLeft, 20),
  }))

  const spacing = computed(() => ({
    paragraph: clampSpacing(store.metadata.paragraphSpacing, 4.5),
    diagram: clampSpacing(store.metadata.diagramSpacing, 5),
    variation: clampSpacing(store.metadata.variationSpacing, 4),
  }))

  /** Il libro usa le due colonne: preferenza attiva e formato ammesso */
  const bookHasTwoColumns = computed(() =>
    !!store.metadata.isTwoColumns && twoColumnsAvailable(store.metadata.pageFormat))

  /** La sezione aperta è a due colonne: copertina e indice restano a colonna unica */
  const twoColumns = computed(() => bookHasTwoColumns.value && store.activeSectionInfo?.type === 'chapter')

  const columnWidthMm = computed(() =>
    columnWidth(store.metadata.pageFormat, margins.value.left, margins.value.right))

  /** Variabili CSS del foglio nell'editor */
  const cssVars = computed(() => ({
    '--chapter-index': store.currentChapterNumber,
    '--page-width': pageSize.value.width,
    '--page-height': pageSize.value.height,
    '--page-margin-top': margins.value.top + 'mm',
    '--page-margin-bottom': margins.value.bottom + 'mm',
    '--page-margin-left': margins.value.left + 'mm',
    '--page-margin-right': margins.value.right + 'mm',
    '--paragraph-spacing': spacing.value.paragraph + 'mm',
    '--diagram-spacing': spacing.value.diagram + 'mm',
    '--variation-spacing': spacing.value.variation + 'mm',
    '--column-gap': COLUMN_GAP_MM + 'mm',
  }))

  return { pageSize, margins, spacing, bookHasTwoColumns, twoColumns, columnWidthMm, cssVars }
}

export type PageLayout = ReturnType<typeof usePageLayout>
