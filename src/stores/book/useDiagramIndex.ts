// Numerazione dei diagrammi e riferimenti incrociati
import { computed, type Ref } from 'vue'
import { scanChapter, type ScanSources } from './sectionScan'
import type { SectionIndexItem } from './types'

export interface DiagramLabel { label: string; caption: string; sectionId: string }

export function useDiagramIndex(sectionIndex: Ref<SectionIndexItem[]>, src: ScanSources) {
  const diagramData = computed(() => {
    const labels = new Map<string, DiagramLabel>()
    const refTargets: string[] = []
    let chapterNumber = 0

    for (const section of sectionIndex.value) {
      if (section.type !== 'chapter') continue
      chapterNumber++ // stessa regola del PDF: contano solo i capitoli

      const scan = scanChapter(section.id, src)

      // Il progressivo conta TUTTI i diagrammi (anche quelli senza ID): coincide col contatore CSS del PDF
      scan.diagrams.forEach((d, i) => {
        if (d.id) {
          labels.set(d.id, {
            label: `${chapterNumber}.${i + 1}`,
            caption: d.caption,
            sectionId: section.id
          })
        }
      })
      refTargets.push(...scan.refTargets)
    }
    return { labels, refTargets }
  })

  const diagramLabels = computed(() => diagramData.value.labels)
  const diagramList = computed(() =>
    Array.from(diagramLabels.value, ([id, v]) => ({ id, ...v }))
  )
  const unresolvedDiagramRefs = computed(() =>
    diagramData.value.refTargets.filter(id => !diagramLabels.value.has(id))
  )

  return { diagramLabels, diagramList, unresolvedDiagramRefs }
}
