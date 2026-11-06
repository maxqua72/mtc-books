// Esportazione PDF: capitolo corrente o libro intero.
// Qui si prepara solo l'HTML: il PDF lo genera pdf-core, nell'app desktop o sul server.
import { nextTick, ref, watch, type ShallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { useChessBookStore } from '../stores/chessBookStore'
import { usePdfStore, type ExportSection } from '../stores/pdfStore'
import { treeIdsInDoc } from '../utils/editorDoc'
import type { PageLayout } from './usePageLayout'
import typographyStyles from '../assets/styles/book-typography.css?raw'
import pdfPrintStyles from '../assets/styles/pdf-print.css?raw'
import { figurinizeHtml } from '../utils/figurines'
import { capabilities } from '../platform'
import { showPdfDesktopNotice } from '../platform/pdfNotice'
import { COLUMN_GAP_MM } from '../utils/twoColumns'

type EditorRef = ShallowRef<Editor | undefined>

export function usePdfExport(editor: EditorRef, layout: PageLayout) {
  const store = useChessBookStore()
  const pdfStore = usePdfStore()

  /** true mentre il client assembla i capitoli (prima di generare il PDF) */
  const isAssembling = ref(false)
  const assemblyLabel = ref('')

  // CSS del PDF: variabili del libro + tipografia condivisa + regole di stampa
  const buildCss = (chapterIndex: number) => {
    const { top, right, bottom, left } = layout.margins.value
    const { paragraph, diagram, variation } = layout.spacing.value
    const variables = `
    :root {
      --page-margin-top: ${top}mm;
      --page-margin-right: ${right}mm;
      --page-margin-bottom: ${bottom}mm;
      --page-margin-left: ${left}mm;
      --page-width: ${layout.pageSize.value.width};
      --chapter-index: ${chapterIndex};
      --paragraph-spacing: ${paragraph}mm;
      --diagram-spacing: ${diagram}mm;
      --variation-spacing: ${variation}mm;
      --column-gap: ${COLUMN_GAP_MM}mm;
    }
  `
    // Numerazione spenta: stessa specificità delle regole di pdf-print.css ma più in basso, quindi vince
    const noNumbering = store.metadata.showNumbering ? '' : `
      .show-numbering h2::before, .show-numbering h3::before, .show-numbering h4::before,
      .book-print-container h2::before, .book-print-container h3::before, .book-print-container h4::before {
        content: none !important;
      }`

    // Il foglio di @page deve coincidere con quello delle opzioni del PDF: se è diverso, Chromium impagina
    // sul foglio di @page e poi riduce tutto al formato scelto (testo più piccolo di 11 pt, margini sbagliati).
    const { width, height } = layout.pageSize.value
    const pageRule = `@page { size: ${width} ${height}; }`

    // Prima la tipografia condivisa con l'editor, poi le regole di stampa (nessuna proprietà in comune)
    return `${variables}\n${typographyStyles}\n${pdfPrintStyles}\n${noNumbering}\n${pageRule}`

  }

  /**
   * HTML reale del DOM dell'editor (con i componenti Vue già espansi), ripulito dall'interfaccia di lavoro.
   * Il numero di capitolo non si imposta qui: lo applica pdf-core con `--chapter-index` sulla sezione.
   */
  const captureEditorHtml = (): string | null => {
    const root = editor.value?.view.dom ?? document.querySelector('.tiptap')
    if (!root) return null

    const clone = root.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.block-header, .diagram-actions-menu').forEach(el => el.remove())
    // Il numero del diagramma lo genera il CSS (::before): il testo del badge andrebbe in doppio
    clone.querySelectorAll('.badge-text').forEach(el => { el.textContent = '' })
    // Riquadri commento vuoti (es. quello della mossa attiva): nel PDF forzerebbero un a-capo
    clone.querySelectorAll('.move-comment-box').forEach(el => {
      if (!el.textContent?.trim()) el.remove()
    })
    // Qui passano solo i capitoli: copertina e indice hanno un HTML proprio e restano a colonna unica
    return layout.twoColumns.value ? `<div class="book-columns">${clone.innerHTML}</div>` : clone.innerHTML
  }

  // Dopo changeActiveSection i watcher hanno già fatto setContent: si attende che i blocchi albero attesi siano nel DOM
  const waitForSectionRender = async (timeoutMs = 4000) => {
    const raf = () => new Promise<void>(r => requestAnimationFrame(() => r()))
    await nextTick()

    const start = performance.now()
    while (performance.now() - start < timeoutMs) {
      const ed = editor.value
      const expected = ed ? treeIdsInDoc(ed.state.doc).length : 0
      const rendered = ed ? ed.view.dom.querySelectorAll('.chess-tree-block-container').length : 0
      if (expected === rendered) break
      await raf()
    }

    await document.fonts.ready   // i font Merida/Cases devono essere pronti per la misura del DOM
    await raf()
    await raf()
  }

  /** Capitolo attivo (o copertina, se è quella aperta) */
  const exportChapter = async () => {
    if (!capabilities.localPdf && !capabilities.cloudPdf) { showPdfDesktopNotice(); return }

    if (store.activeSectionInfo?.type === 'index') {
      alert("L'indice si esporta solo con il libro intero: i numeri di pagina si calcolano lì.")
      return
    }
    const pageSize = store.metadata.pageFormat || 'a4'

    if (store.activeSectionInfo?.type === 'cover') {
      try {
        store.syncActiveSectionToCache()
        
        await pdfStore.exportCurrentChapter({
          htmlContent: await store.buildCoverHtml(store.activeSectionId!),
          customCss: buildCss(1),
          title: store.activeSectionInfo.title || 'copertina',
          chapterNumber: 1,
          pageSize
        })
      } catch {
        alert("Si è verificato un errore durante l'esportazione della copertina.")
      }
      return
    }

    if (!editor.value) return
    const htmlContent = captureEditorHtml()
    if (htmlContent === null) {
      alert("Impossibile trovare il contenuto dell'editor da esportare.")
      return
    }

    const chapterNumber = store.currentChapterNumber
    try {
      await pdfStore.exportCurrentChapter({
        htmlContent,
        customCss: buildCss(chapterNumber),
        title: store.activeSectionInfo?.title || 'capitolo',
        chapterNumber,
        pageSize
      })
    } catch {
      alert("Si è verificato un errore durante l'esportazione del capitolo.")
    }
  }

  /** Libro intero: si apre ogni capitolo nell'editor per catturarne il DOM reale, poi si torna dov'era l'utente */
  const exportBook = async () => {

    if (!capabilities.localPdf && !capabilities.cloudPdf) { showPdfDesktopNotice(); return }
    
    if (isAssembling.value) return   // evita due export concorrenti (doppio click)
    if (store.sectionIndex.length === 0) {
      alert('Nessun capitolo presente da esportare.')
      return
    }

    const orphans = store.unresolvedDiagramRefs.length
    if (orphans > 0 && !confirm(
      `Ci sono ${orphans} riferimenti a diagrammi che non esistono più (compaiono come "?"). Esportare comunque?`
    )) return

    isAssembling.value = true
    const originalSectionId = store.activeSectionId
    let restored = false

    const restoreOriginalSection = async () => {
      if (restored) return
      restored = true
      if (originalSectionId && store.activeSectionId !== originalSectionId) {
        await store.changeActiveSection(originalSectionId)
        await nextTick()
      }
    }

    try {
      // CONGELA il capitolo attivo (editor -> store -> cache, con html e alberi):
      // senza questo passaggio le modifiche recenti andrebbero perse al ripristino finale
      window.dispatchEvent(new CustomEvent('request-editor-sync'))
      if (store.activeSectionInfo?.type !== 'index') store.syncActiveSectionToCache()

      const sections: ExportSection[] = []
      let chapterCounter = 0

      for (const section of store.sectionIndex) {
        assemblyLabel.value = `Sezione ${store.sectionIndex.indexOf(section) + 1} di ${store.sectionIndex.length}: ${section.title}`
        if (section.type === 'chapter') chapterCounter++

        let html = ''
        if (section.type === 'index') {
          html = figurinizeHtml(store.generatedTocHtml)
        } else if (section.type === 'cover') {
          html = await store.buildCoverHtml(section.id)
        } else {
          if (store.activeSectionId !== section.id) await store.changeActiveSection(section.id)
          await waitForSectionRender()
          html = captureEditorHtml() ?? ''
        }

        sections.push({ id: section.id, title: section.title, type: section.type, chapterNumber: chapterCounter, html })
      }

      // Si riporta l'utente dov'era PRIMA di generare il PDF (che può essere lungo)
      await restoreOriginalSection()

      await pdfStore.exportFullBook({
        sections,
        customCss: buildCss(1),
        bookTitle: store.metadata.title || 'libro',
        pageSize: store.metadata.pageFormat || 'a4'
      })
    } catch (err) {
      console.error('Errore esportazione libro:', err)
      alert("Si è verificato un errore durante l'esportazione del libro completo.")
    } finally {
      await restoreOriginalSection()   // se qualcosa è fallito a metà, ripristina comunque
      isAssembling.value = false
      assemblyLabel.value = ''
    }
  }

  // Segnali dall'header
  watch(() => store.exportServerChapterSignal, () => { void exportChapter() })
  watch(() => store.exportServerFullBookSignal, () => { void exportBook() })

  return { isAssembling, assemblyLabel }
}