// HTML dell'indice generale, ricavato dai titoli dei capitoli
import { computed, type Ref } from 'vue'
import { escapeHtml } from '../../utils/html'
import { scanChapter, type ScanSources } from './sectionScan'
import { isContentSection, isGeneratedSection } from '../../utils/sectionOrder'
import type { BookMetadata, SectionIndexItem } from './types'

const FONT = 'font-family: Lora, Georgia, serif;'

export function useGeneratedToc(
    sectionIndex: Ref<SectionIndexItem[]>, 
    src: ScanSources, 
    metadata: Ref<BookMetadata>) {
  return computed(() => {
    const numbered = metadata.value.showNumbering
    // Nell'ordine del libro: capitoli con tutti i titoli, sezioni senza numero con il solo Titolo 1.
    // Le sezioni generate hanno un solo Titolo 1, con il nome della sezione (vedi utils/generatedSections).
    const sections = sectionIndex.value.filter(s => isContentSection(s.type) || isGeneratedSection(s.type))

    if (sections.length === 0) {
      return `
  <div class="toc-container">
    <h2>Indice Generale</h2>
    <p style="color: #a3a3a3; font-style: italic;">Nessun capitolo inserito nel libro.</p>
  </div>
`
    }

    // Gli !important in linea battono le regole degli elenchi di book-typography.css (pallini, rientro e spazi
    // degli elenchi del testo), che nel PDF valgono anche qui
    let html = `<div class="toc-container"><h2 style="${FONT} font-size: 2rem; margin-bottom: 1.5rem;">Indice Generale</h2><ul style="list-style: none !important; padding: 0 !important; margin: 0 !important; ${FONT}">`

    let entryIndex = 0   // progressivo globale: corrisponde all'id toc-h-N assegnato da pdf-core (prepareToc)
    let mainCounter = 0

    sections.forEach((sec) => {
      const isChapter = sec.type === 'chapter'
      if (isChapter) mainCounter++
      let subCounter = 0
      let subSubCounter = 0

      const headings = isGeneratedSection(sec.type) ? [{ level: '1', text: sec.title }] : scanChapter(sec.id, src).headings
      for (const h of headings) {
        if (!isChapter && h.level !== '1') continue
        const text = escapeHtml(h.text || 'Titolo senza testo')
        let numbering: string
        let paddingLeft: string
        let fontSize: string
        let fontWeight = 'bold'

        if (h.level === '1') {
          numbering = numbered && isChapter ? `${mainCounter}. ` : ''
          paddingLeft = '0px'
          fontSize = '1.1rem'
        } else if (h.level === '3') {
          subSubCounter++
          numbering = numbered ? `${mainCounter}.${subCounter}.${subSubCounter} ` : ''
          paddingLeft = '40px'
          fontSize = '0.875rem'
          fontWeight = 'normal'
        } else {
          subCounter++
          subSubCounter = 0
          numbering = numbered ? `${mainCounter}.${subCounter} ` : ''
          paddingLeft = '20px'
          fontSize = '0.95rem'
          fontWeight = 'normal'
        }

        html += `
    <li class="toc-entry" data-toc-n="${entryIndex++}" style="display: flex !important; align-items: baseline; gap: 6px; margin: 0 0 8px 0 !important; padding-left: ${paddingLeft} !important; font-size: ${fontSize}; font-weight: ${fontWeight}; break-inside: avoid;">
      <span class="toc-title">${numbering}${text}</span>
      <span class="toc-leader" style="flex: 1; border-bottom: 1px dotted #a3a3a3; transform: translateY(-3px);"></span>
      <span class="toc-page" style="min-width: 3ch; text-align: right; font-variant-numeric: tabular-nums; color: #404040;">…</span>
    </li>
  `
      }
    })

    return html + `</ul></div>`
  })
}
