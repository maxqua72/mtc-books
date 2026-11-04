// HTML dell'indice generale, ricavato dai titoli dei capitoli
import { computed, type Ref } from 'vue'
import { escapeHtml } from '../../utils/html'
import { scanChapter, type ScanSources } from './sectionScan'
import type { BookMetadata, SectionIndexItem } from './types'

const FONT = 'font-family: Lora, Georgia, serif;'

export function useGeneratedToc(
    sectionIndex: Ref<SectionIndexItem[]>, 
    src: ScanSources, 
    metadata: Ref<BookMetadata>) {
  return computed(() => {
    const numbered = metadata.value.showNumbering
    const chapters = sectionIndex.value.filter(s => s.type === 'chapter')

    if (chapters.length === 0) {
      return `
  <div class="toc-container">
    <h2>Indice Generale</h2>
    <p style="color: #a3a3a3; font-style: italic;">Nessun capitolo inserito nel libro.</p>
  </div>
`
    }

    let html = `<div class="toc-container"><h2 style="${FONT} font-size: 2rem; margin-bottom: 1.5rem;">Indice Generale</h2><ul style="list-style: none; padding: 0; margin: 0; ${FONT}">`

    let entryIndex = 0   // progressivo globale: corrisponde all'id toc-h-N assegnato dal server

    chapters.forEach((ch, i) => {
      const mainCounter = i + 1
      let subCounter = 0
      let subSubCounter = 0

      for (const h of scanChapter(ch.id, src).headings) {
        const text = escapeHtml(h.text || 'Titolo senza testo')
        let numbering: string
        let paddingLeft: string
        let fontSize: string
        let fontWeight = 'bold'

        if (h.level === '1') {
          //numbering = `${mainCounter}. `
          numbering = numbered ? `${mainCounter}. ` : ''
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
          //numbering = `${mainCounter}.${subCounter} `
          numbering = numbered ? `${mainCounter}.${subCounter} ` : ''
          paddingLeft = '20px'
          fontSize = '0.95rem'
          fontWeight = 'normal'
        }

        html += `
    <li class="toc-entry" data-toc-n="${entryIndex++}" style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; padding-left: ${paddingLeft}; font-size: ${fontSize}; font-weight: ${fontWeight}; break-inside: avoid;">
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
