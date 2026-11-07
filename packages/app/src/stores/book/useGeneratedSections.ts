// HTML delle sezioni generate (legenda dei simboli, indici delle partite e dei giocatori), ricavato dagli alberi.
// È un computed: si ricalcola solo quando qualcuno lo legge (sezione aperta nell'editor o esportazione).
import { computed, type Ref } from 'vue'
import type { ChessTree } from '../chessTreeStore'
import type { SectionIndexItem } from './types'
import { scanChapter, type ScanSources } from './sectionScan'
import { isContentSection } from '../../utils/sectionOrder'
import { collectSymbols, symbolsLegendHtml } from '../../utils/generatedSections'

export function useGeneratedSections(sectionIndex: Ref<SectionIndexItem[]>, src: ScanSources) {
  /** Alberi del libro nell'ordine di lettura, con la sezione in cui stanno */
  const bookTrees = computed(() => {
    const out: { section: SectionIndexItem; tree: ChessTree }[] = []
    for (const section of sectionIndex.value) {
      if (!isContentSection(section.type)) continue
      for (const tree of scanChapter(section.id, src).trees) out.push({ section, tree })
    }
    return out
  })

  const usedSymbols = computed(() => collectSymbols(bookTrees.value.map((t) => t.tree)))

  /** HTML della sezione generata (stringa vuota per gli altri tipi) */
  const generatedHtml = (section: SectionIndexItem): string => {
    if (section.type === 'symbols') return symbolsLegendHtml(section.title, usedSymbols.value)
    return ''
  }

  return { bookTrees, generatedHtml }
}
