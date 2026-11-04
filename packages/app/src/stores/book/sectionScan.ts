// Analisi (parsing HTML) dei capitoli: diagrammi, riferimenti e titoli.
// Il DOMParser è la parte costosa: il risultato si riusa finché la sorgente del capitolo non cambia.
import type { Ref } from 'vue'
import { extractTreeIds } from '../../utils/html'
import type { ChessTree } from '../chessTreeStore'

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
  activeTrees?: Ref<ChessTree[]>   // alberi del capitolo aperto (per gli altri stanno nella cache)
}

const REF_IN_COMMENT = /data-target-id="([\w-]{1,80})"/g


/** Id dei diagrammi citati nei commenti delle mosse degli alberi usati dal capitolo */
function collectCommentRefs(trees: unknown, usedTreeIds: Set<string>): string[] {
  const out: string[] = []
  if (!Array.isArray(trees)) return out
  const stack: any[] = []
  for (const t of trees) if (t && usedTreeIds.has(t.id) && Array.isArray(t.rootNodes)) stack.push(...t.rootNodes)
  while (stack.length) {
    const n = stack.pop()
    if (typeof n?.comment === 'string' && n.comment.includes('diagram-ref')) {
      for (const m of n.comment.matchAll(REF_IN_COMMENT)) out.push(m[1])
    }
    if (Array.isArray(n?.children)) stack.push(...n.children)
  }
  return out
}

// Fuori dalla reattività: un capitolo si rianalizza solo se la sua sorgente è cambiata
const sectionScanCache = new Map<string, { source: string; scan: SectionScan }>()

const scanSection = (sectionId: string, source: string, isJson: boolean): SectionScan => {
  const cached = sectionScanCache.get(sectionId)
  if (cached && cached.source === source) return cached.scan

  let html = source
  let trees: unknown = []
  if (isJson) {
    try {
      const parsed = source ? JSON.parse(source) : {}
      html = parsed.html || ''
      trees = parsed.trees
    } catch { html = '' }
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  
  const scan: SectionScan = {
    diagrams: Array.from(doc.querySelectorAll('[data-type="chess-diagram"]')).map(el => ({
      id: el.getAttribute('data-id'),
      caption: el.querySelector('.diagram-caption')?.textContent?.trim() ?? ''
    })),
    refTargets: [
      ...Array.from(doc.querySelectorAll('[data-type="diagram-ref"]'))
        .map(el => el.getAttribute('data-target-id') || '')
        .filter(Boolean),
      ...collectCommentRefs(trees, new Set(extractTreeIds(html))),
    ],
    headings: Array.from(doc.querySelectorAll('[data-toc-level]'))
      .map(el => ({
        level: el.getAttribute('data-toc-level') ?? '',
        text: el.textContent?.trim() ?? ''
      }))
      .filter(h => h.level === '1' || h.level === '2' || h.level === '3'),
  }
  sectionScanCache.set(sectionId, { source, scan })
  return scan
}

/** Il capitolo attivo si legge dall'editor (HTML puro), gli altri dalla cache (JSON). Legge i ref: va chiamata dentro un computed. */
export function scanChapter(sectionId: string, src: ScanSources): SectionScan {
  if (sectionId !== src.activeSectionId.value) {
    return scanSection(sectionId, src.zippedSectionsCache.value[sectionId] || '', true)
  }
  const html = src.activeSectionHtml.value
  const scan = scanSection(sectionId, html, false)
  const extra = collectCommentRefs(src.activeTrees?.value, new Set(extractTreeIds(html)))
  return extra.length ? { ...scan, refTargets: [...scan.refTargets, ...extra] } : scan
}
