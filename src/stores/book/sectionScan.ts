// Analisi (parsing HTML) dei capitoli: diagrammi, riferimenti e titoli.
// Il DOMParser è la parte costosa: il risultato si riusa finché la sorgente del capitolo non cambia.
import type { Ref } from 'vue'

export interface SectionScan {
  diagrams: { id: string | null; caption: string }[]
  refTargets: string[]
  headings: { level: string; text: string }[]
}

/** Sorgenti reattive da cui si legge il contenuto di un capitolo */
export interface ScanSources {
  activeSectionId: Ref<string | null>
  activeSectionHtml: Ref<string>
  zippedSectionsCache: Ref<Record<string, string>>
}

// Fuori dalla reattività: un capitolo si rianalizza solo se la sua sorgente è cambiata
const sectionScanCache = new Map<string, { source: string; scan: SectionScan }>()

const scanSection = (sectionId: string, source: string, isJson: boolean): SectionScan => {
  const cached = sectionScanCache.get(sectionId)
  if (cached && cached.source === source) return cached.scan

  let html = source
  if (isJson) {
    try { html = source ? JSON.parse(source).html || '' : '' } catch { html = '' }
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const scan: SectionScan = {
    diagrams: Array.from(doc.querySelectorAll('[data-type="chess-diagram"]')).map(el => ({
      id: el.getAttribute('data-id'),
      caption: el.querySelector('.diagram-caption')?.textContent?.trim() ?? ''
    })),
    refTargets: Array.from(doc.querySelectorAll('[data-type="diagram-ref"]'))
      .map(el => el.getAttribute('data-target-id') || '')
      .filter(Boolean),
    headings: Array.from(doc.querySelectorAll('[data-toc-level]'))
      .map(el => ({
        level: el.getAttribute('data-toc-level') ?? '',
        text: el.textContent?.trim() ?? ''
      }))
      .filter(h => h.level === '1' || h.level === '2'),
  }
  sectionScanCache.set(sectionId, { source, scan })
  return scan
}

/** Il capitolo attivo si legge dall'editor (HTML puro), gli altri dalla cache (JSON). Legge i ref: va chiamata dentro un computed. */
export function scanChapter(sectionId: string, src: ScanSources): SectionScan {
  return sectionId === src.activeSectionId.value
    ? scanSection(sectionId, src.activeSectionHtml.value, false)
    : scanSection(sectionId, src.zippedSectionsCache.value[sectionId] || '', true)
}
