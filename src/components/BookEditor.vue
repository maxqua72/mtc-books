<template>
    <div class="flex-1 bg-white border border-neutral-200 rounded-xl flex flex-col shadow-sm overflow-hidden relative">

        <!-- OVERLAY DI CARICAMENTO PER OPZIONE B -->
        <div v-if="isGeneratingPdf"
            class="absolute inset-0 bg-white/95 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center gap-4">
            <div class="w-12 h-12 border-4 border-neutral-800 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-center">
                <p class="font-semibold text-neutral-800 text-lg">Generazione del libro in corso...</p>
                <p class="text-sm text-neutral-500 mt-1">Stiamo assemblando i capitoli e i diagrammi.</p>
            </div>
        </div>

        <!-- Inserimento della Toolbar Modulare -->
        <EditorToolbar v-if="editor" :editor="editor" />

        <!-- Area di Scrittura Effettiva -->
        <div id="book-editor-content" class="flex-1 overflow-y-auto">
            <div class="tiptap-container" :class="{
                'show-numbering': store.metadata.showNumbering,
                'is-structural-page': store.activeSectionInfo?.type === 'cover' || store.activeSectionInfo?.type === 'index'
            }" :style="{
                '--chapter-index': currentChapterNumber,
                '--page-width': getPageSizeStyles.width,
                '--page-height': getPageSizeStyles.height,
                '--page-margin-top': (store.metadata.pageMarginTop || 25) + 'mm',
                '--page-margin-bottom': (store.metadata.pageMarginBottom || 25) + 'mm',
                '--page-margin-left': (store.metadata.pageMarginLeft || 20) + 'mm',
                '--page-margin-right': (store.metadata.pageMarginRight || 20) + 'mm'
            }">
                <editor-content :editor="editor" />
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { PDFDocument } from 'pdf-lib'
import { watch, onMounted, onBeforeUnmount, computed, ref, nextTick } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { ChessDiagram } from '../extensions/ChessDiagram'
import { CustomHeading } from '../extensions/CustomHeading' // Aggiusta il percorso se serve
import EditorToolbar from './EditorToolbar.vue'

// @ts-ignore
import html2pdf from 'html2pdf.js'

const store = useChessBookStore()
const isGeneratingPdf = ref(false)

const getPageSizeStyles = computed(() => {
    const format = store.metadata.pageFormat || 'a4'

    const formats: Record<string, { width: string; height: string }> = {
        'a4': { width: '210mm', height: '297mm' },
        'crown-quarto': { width: '189mm', height: '246mm' },
        'b-format': { width: '129mm', height: '198mm' }
    }

    return formats[format] || formats['a4']
})

const editor = useEditor({
    content: `
    <h2>Capitolo 1 — Introduzione</h2>
    <p>Questo è il testo del tuo nuovo libro sugli scacchi. Puoi selezionare il testo per formattarlo in <strong>grassetto</strong> o <em>corsivo</em> utilizzando la toolbar superiore.</p>
    <p>Muovi i pezzi sulla destra per impostare una variante, posiziona il cursore del testo qui sotto e premi il bottone nero sulla console.</p>
  `,
    extensions: [
        StarterKit.configure({
            heading: false // Disabilitiamo sempre l'heading standard per evitare conflitti
        }),
        CustomHeading, // <-- Estensione personalizzata per h2 e h3
        ChessDiagram, // <-- Registriamo l'estensione del nostro diagramma scacchistico
    ],
    editorProps: {
        attributes: {
            class: 'prose prose-neutral font-serif text-lg text-neutral-800 focus:outline-none leading-relaxed max-w-none',
        },
    },
    // Aggiorna lo store locale durante la digitazione per l'auto-save temporaneo
    onUpdate({ editor }) {
        store.activeSectionHtml = editor.getHTML()
    }
})




// Ascolta se lo store cambia la sezione attiva esternamente (es: all'apertura di un file)
// Ascolta se lo store cambia la sezione attiva esternamente (es: selezione dalla barra laterale)
watch(() => store.activeSectionId, (newSectionId) => {
    if (!newSectionId || !editor.value) return

    // 1. Recuperiamo le info della sezione corrente
    const currentSection = store.sectionIndex.find(s => s.id === newSectionId)

    // 2. Se è l'INDICE, carichiamo il getter computato e blocchiamo l'editor (sola lettura)
    if (currentSection?.type === 'index') {
        editor.value.commands.setContent(store.generatedTocHtml)
        editor.value.setOptions({ editable: false }) // UX pulita: l'indice si autogestisce
        return
    }

    // 3. Se è la COPERTINA e non ha testo, iniettiamo un template di base editabile
    if (currentSection?.type === 'cover' && !store.activeSectionHtml) {
        editor.value.setOptions({ editable: true })
        editor.value.commands.setContent(`
      <h1 style="text-align: center; font-size: 3rem; margin-top: 5rem;">Titolo del Libro</h1>
      <p style="text-align: center; font-style: italic;">Autore</p>
    `)
        return
    }

    // 4. Per i CAPITOLI normali, sblocchiamo l'editor e carichiamo il loro HTML
    editor.value.setOptions({ editable: true })
    editor.value.commands.setContent(store.activeSectionHtml)
})

// Se l'utente sta visualizzando l'indice e l'indice cambia (es. aggiunge capitoli), aggiorna lo schermo
watch(() => store.generatedTocHtml, (newTocHtml) => {
    const currentSection = store.sectionIndex.find(s => s.id === store.activeSectionId)
    if (currentSection?.type === 'index' && editor.value) {
        editor.value.commands.setContent(newTocHtml)
    }
})

// Sincronizza l'HTML prima del salvataggio definitivo su file
const syncEditorContent = () => {
    if (editor.value) {
        store.activeSectionHtml = editor.value.getHTML()
    }
}

onMounted(() => {
    window.addEventListener('request-editor-sync', syncEditorContent)

    // Se lo store è vuoto all'avvio, inizializziamo una prima sezione di default
    if (store.sectionIndex.length === 0) {
        const defaultId = store.createNewSection("Capitolo 1 — Introduzione", "chapter")
        store.changeActiveSection(defaultId, editor.value?.getHTML())
    }
})

onBeforeUnmount(() => {
    window.removeEventListener('request-editor-sync', syncEditorContent)
})

// Funzione ausiliaria per convertire il FEN nella stringa di testo originale per il font Chess Merida
const fenToChessFontString = (fen: string): string => {
    const [position] = fen.split(' ')
    const rows = position.split('/')

    // Mappatura dei pezzi neri e bianchi su case chiare e scure per il font puro
    // NOTA: Questa è la codifica standard dei font TrueType scacchistici (es. Merida/Ushuaia)
    // Se la tua implementazione usa caratteri diversi, adattali qui.
    return rows.map((row) => {
        let rowString = ''
        let isDark = true // Alternanza case (assumendo convenzione del font)

        for (const char of row) {
            if (isNaN(Number(char))) {
                rowString += char // Pezzo ('p', 'R', 'K', ecc.)
            } else {
                // Spazi vuoti: il font genera le case vuote (es. alternando spazi o caratteri specifici)
                const emptySpaces = Number(char)
                for (let i = 0; i < emptySpaces; i++) {
                    rowString += ' ' // O il carattere che il tuo font usa per la casa vuota
                }
            }
        }
        return rowString
    }).join('\n')
}

const generatePdf1 = () => {
    // 1. CATTURIAMO DIRETTAMENTE IL FOGLIO (evitando i contenitori esterni che creano disallineamenti)
    const originalElement = document.querySelector('.tiptap-container') as HTMLElement
    if (!originalElement) return

    // 2. CLONAZIONE MANUALE PRE-RENDERING
    const containerClone = originalElement.cloneNode(true) as HTMLElement

    // 3. PULIZIA STRUTTURALE (Rimuoviamo ombre, bordi e resettiamo l'altezza minima)
    containerClone.style.setProperty('box-shadow', 'none', 'important')
    containerClone.style.setProperty('border', 'none', 'important')
    containerClone.style.setProperty('margin', '0', 'important')
    containerClone.style.setProperty('height', 'auto', 'important')
    containerClone.style.setProperty('min-height', 'auto', 'important') /* <-- AGGIUNGI QUESTO */
    containerClone.style.setProperty('max-height', 'none', 'important')
    containerClone.style.setProperty('overflow', 'visible', 'important')
    // Rimuoviamo i menu a comparsa dei diagrammi scacchi per non stamparli nel PDF
    containerClone.querySelectorAll('.diagram-actions-menu').forEach(menu => menu.remove())

    // 4. CONFIGURAZIONE OPZIONI HTML2PDF (Margine a 0 perché usiamo già i mm del foglio)
    const options = {
        margin: 0, // Azzerato per usare esclusivamente il padding nativo del foglio
        filename: 'libro_scacchi.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollY: 0,
            onclone: (clonedDoc: Document) => {
                // Iniettiamo i fogli di stile tipografici nel documento temporaneo di stampa
                const styleTag = clonedDoc.createElement('style')
                styleTag.innerHTML = `
          /* Rimuoviamo gli elementi visivi del foglio di lavoro */
          .tiptap-container {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            background: #ffffff !important;
            min-height: auto !important; /* <-- AGGIUNGI QUESTO */
            height: auto !important;     /* <-- AGGIUNGI QUESTO */
            }
          
          .tiptap, .prose {
            color: #171717 !important;
            display: block !important;
            opacity: 1 !important;
            visibility: visible !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .chess-diagram-container { 
            display: flex !important; 
            align-items: center !important; 
            justify-content: center !important; 
          }

          .chess-pure-text {
            font-family: 'Chess Merida', serif !important;
            font-size: var(--diagram-size) !important;
            line-height: 1.1 !important;
            white-space: pre !important;
            color: #000000 !important;
            display: block !important;
            background: transparent !important;
            text-align: center !important;
            margin: 0 auto !important;
            overflow: visible !important;
            padding-bottom: 4px !important;
          }
          
          h2 { font-size: 24pt !important; font-weight: bold !important; margin-top: 14pt !important; margin-bottom: 12pt !important; font-family: Georgia, serif !important; color: #171717 !important; }
          h3 { font-size: 16pt !important; font-weight: bold !important; margin-top: 18pt !important; margin-bottom: 8pt !important; font-family: Georgia, serif !important; color: #171717 !important; }
          p { margin-bottom: 10pt !important; font-size: 11pt !important; line-height: 1.5 !important; color: #171717 !important; }
        `
                clonedDoc.head.appendChild(styleTag)
            }
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] as const }
    }

    // 5. GENERA IL PDF PASZANDO IL CLONE SROTOLATO
    html2pdf().set(options).from(containerClone).save()
}

const generatePdf = () => {
    // 1. CATTURIAMO DIRETTAMENTE IL FOGLIO VISIBILE A SCHERMO
    const originalElement = document.querySelector('.tiptap-container') as HTMLElement
    if (!originalElement) return

    const pageSize = getPageSizeStyles.value

    const marginTop = store.metadata.pageMarginTop || 25
    const marginRight = store.metadata.pageMarginRight || 20
    const marginBottom = store.metadata.pageMarginBottom || 25
    const marginLeft = store.metadata.pageMarginLeft || 20

    // 2. CLONAZIONE DI SICUREZZA PER NON ROVINARE L'INTERFACCIA UTENTE
    const containerClone = originalElement.cloneNode(true) as HTMLElement

    // BLOCCO DIMENSIONI REALI SUL CLONE IN MILLIMETRI
    containerClone.style.setProperty('width', pageSize.width, 'important')
    containerClone.style.setProperty('max-width', pageSize.width, 'important')
    containerClone.style.setProperty('min-width', pageSize.width, 'important')
    containerClone.style.setProperty('box-sizing', 'border-box', 'important')

    // 3. PULIZIA STRUTTURALE (Rimuoviamo ombre, bordi, forziamo l'altezza auto)
    containerClone.style.setProperty('box-shadow', 'none', 'important')
    containerClone.style.setProperty('border', 'none', 'important')
    containerClone.style.setProperty('margin', '0', 'important')
    containerClone.style.setProperty('height', 'auto', 'important')
    containerClone.style.setProperty('min-height', 'auto', 'important')
    containerClone.style.setProperty('max-height', 'none', 'important')
    containerClone.style.setProperty('overflow', 'visible', 'important')
    containerClone.setAttribute('spellcheck', 'false')


    // Rimuoviamo i menu del diagramma
    containerClone.querySelectorAll('.diagram-actions-menu').forEach(menu => menu.remove())

    // 4. CONFIGURAZIONE OPZIONI HTML2PDF
    const isCustomFormat = store.metadata.pageFormat === 'crown-quarto' || store.metadata.pageFormat === 'b-format'
    const pdfFormat: string | [number, number] = isCustomFormat
        ? [parseFloat(pageSize.width), parseFloat(pageSize.height)] as [number, number]
        : 'a4'

    const options = {
        margin: 0,
        filename: `${store.activeSectionInfo?.title || 'capitolo'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollY: 0,
            onclone: (clonedDoc: Document) => {
                const styleTag = clonedDoc.createElement('style')
                styleTag.innerHTML = `
          /* Convertiamo tutti i potenziali colori OKLCH di Tailwind in HEX puri */
          .tiptap-container, .tiptap-container * {
                    border-color: #e5e7eb !important;
                  }
                  .tiptap-container {
                    counter-reset: chapter-count var(--chapter-index) section-count 0;
                    box-shadow: none !important;
                    border: none !important;
                    margin: 0 !important;
                    background-color: #ffffff !important;
                    padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm !important;
                    width: ${pageSize.width} !important;
                    max-width: ${pageSize.width} !important;
                    min-width: ${pageSize.width} !important;
                    min-height: auto !important;
                    height: auto !important;
                    box-sizing: border-box !important;
                  }
                  .tiptap, .prose, .prose p, .tiptap p {
                    color: #171717 !important;
                  }
                  .prose h1, .tiptap h1, .prose h2, .tiptap h2, .prose h3, .tiptap h3, .prose strong, .tiptap strong {
                    color: #171717 !important;
                  }
                  .chess-diagram-container { 
                    display: flex !important; 
                    align-items: center !important; 
                    justify-content: center !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }
                  .chess-pure-text {
                    font-family: 'Chess Merida', serif !important;
                    font-size: var(--diagram-size) !important;
                    line-height: 1.1 !important;
                    white-space: pre !important;
                    color: #000000 !important;
                    display: block !important;
                    background: transparent !important;
                    text-align: center !important;
                    margin: 0 auto !important;
                    overflow: visible !important;
                  }
                  h2 { font-size: 24pt !important; font-weight: bold !important; margin-top: 14pt !important; margin-bottom: 12pt !important; font-family: Georgia, serif !important; page-break-inside: avoid !important; break-inside: avoid !important; }
                  h3 { font-size: 16pt !important; font-weight: bold !important; margin-top: 18pt !important; margin-bottom: 8pt !important; font-family: Georgia, serif !important; page-break-inside: avoid !important; break-inside: avoid !important; }
                  p { margin-bottom: 10pt !important; font-size: 11pt !important; line-height: 1.5 !important; page-break-inside: avoid !important; break-inside: avoid !important; }
                  .show-numbering h2::before { content: counter(chapter-count) ". "; }
                  .show-numbering h3::before { content: counter(chapter-count) "." counter(section-count) " "; }
                  .is-structural-page h2::before, .is-structural-page h3::before { content: none !important; }
                `
                clonedDoc.head.appendChild(styleTag)
            }
        },
        jsPDF: { unit: 'mm' as const, format: pdfFormat, orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] as const, avoid: ['p', 'h1', 'h2', 'h3', '.chess-diagram-container'] }
    }

    html2pdf().set(options).from(containerClone).save()
}

const generateFullBookPdf = async () => {
    if (store.sectionIndex.length === 0) {
        alert("Nessun capitolo presente da esportare.")
        return
    }

    // Saliamo l'ID della sezione attualmente visualizzata per ripristinarla alla fine
    const originalActiveSectionId = store.activeSectionId
    isGeneratingPdf.value = true
    
    console.log("%c[PDF LIVE ENGINE] --- INIZIO ESPORTAZIONE LIBRO COMPLETO ---", "color: #0284c7; font-weight: bold; font-size: 14px;");

    try {
        const pdfBuffers: ArrayBuffer[] = []
        let chapterCounter = 0
        const pageSize = getPageSizeStyles.value

        // Cicliamo tutte le sezioni del libro
        for (let index = 0; index < store.sectionIndex.length; index++) {
            const section = store.sectionIndex[index]

            if (section.type === 'chapter') {
                chapterCounter++
            }

            console.log(`[PDF LIVE ENGINE] Cambio sezione attiva -> Rinnovamento DOM per: "${section.title}"`);
            
            // 1. FORZIAMO LO STORE A CAMBIARE CAPITOLO (Attiva il rendering reale a schermo)
            store.activeSectionId = section.id

            // 2. ATTESA DOPPIA (Vue Tick + Timeout per Tiptap ed estensioni diagrammi)
            await nextTick()
            await new Promise((resolve) => setTimeout(resolve, 400)) // Tempo fondamentale per far svegliare i Web Component dei diagrammi

            // 3. CATTURIAMO IL CONTENITORE VIVO APPENA MONTATO
            const originalElement = document.querySelector('.tiptap-container') as HTMLElement
            if (!originalElement) {
                console.warn(`[PDF LIVE ENGINE] Impossibile trovare .tiptap-container per la sezione: ${section.title}`);
                continue
            }

            // Verifichiamo nei log se il diagramma è effettivamente vivo e popolato
            const liveDiagrams = originalElement.querySelectorAll('.chess-pure-text')
            console.log(`[PDF LIVE ENGINE] Stato elementi a schermo per "${section.title}": Diagrammi trovati = ${liveDiagrams.length}`);
            if (liveDiagrams.length > 0) {
                console.log(` -> Testo reale renderizzato dall'estensione: "${liveDiagrams[0].textContent?.substring(0, 40).replace(/\n/g, ' ')}..."`);
            }

            // 4. CLONAZIONE DI SICUREZZA (Come nella funzione singola che funziona)
            const containerClone = originalElement.cloneNode(true) as HTMLElement

            // BLOCCO DIMENSIONI REALI SUL CLONE IN MILLIMETRI (Anche all'interno della Full)
            containerClone.style.setProperty('width', pageSize.width, 'important')
            containerClone.style.setProperty('max-width', pageSize.width, 'important')
            containerClone.style.setProperty('min-width', pageSize.width, 'important')
            containerClone.style.setProperty('box-sizing', 'border-box', 'important')

            // Pulizia strutturale immediata sul clone
            containerClone.style.setProperty('box-shadow', 'none', 'important')
            containerClone.style.setProperty('border', 'none', 'important')
            containerClone.style.setProperty('margin', '0', 'important')
            containerClone.style.setProperty('height', 'auto', 'important')
            containerClone.style.setProperty('min-height', 'auto', 'important')
            containerClone.style.setProperty('max-height', 'none', 'important')
            containerClone.style.setProperty('overflow', 'visible', 'important')
            containerClone.setAttribute('spellcheck', 'false')

            // Rimuoviamo i menu contestuali dei diagrammi
            containerClone.querySelectorAll('.diagram-actions-menu').forEach(menu => menu.remove())

            // Configurazione formati e opzioni ereditate dalla funzione funzionante
            const isCustomFormat = store.metadata.pageFormat === 'crown-quarto' || store.metadata.pageFormat === 'b-format'
            const pdfFormat: string | [number, number] = isCustomFormat
                ? [parseFloat(pageSize.width), parseFloat(pageSize.height)] as [number, number]
                : 'a4'

            // Manteniamo i contatori del capitolo corretti anche se cambiamo pagina al volo
            const currentChapterIndex = chapterCounter

            const marginTop = store.metadata.pageMarginTop || 25
            const marginRight = store.metadata.pageMarginRight || 20
            const marginBottom = store.metadata.pageMarginBottom || 25
            const marginLeft = store.metadata.pageMarginLeft || 20

            const options = {
                margin: 0,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    scrollY: 0,
                    onclone: (clonedDoc: Document) => {
                        const styleTag = clonedDoc.createElement('style')
                        styleTag.innerHTML = `
                          .tiptap-container, .tiptap-container * {
                            border-color: #e5e7eb !important;
                          }
                          .tiptap-container {
                            counter-reset: chapter-count ${currentChapterIndex} section-count 0 !important;
                            box-shadow: none !important;
                            border: none !important;
                            margin: 0 !important;
                            background-color: #ffffff !important;
                            padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm !important;
                            width: ${pageSize.width} !important;
                            max-width: ${pageSize.width} !important;
                            min-width: ${pageSize.width} !important;
                            min-height: auto !important;
                            height: auto !important;
                            box-sizing: border-box !important;
                          }
                          .tiptap, .prose, .prose p, .tiptap p {
                            color: #171717 !important;
                          }
                          .prose h1, .tiptap h1, .prose h2, .tiptap h2, .prose h3, .tiptap h3, .prose strong, .tiptap strong {
                            color: #171717 !important;
                          }
                          .chess-diagram-container { 
                            display: flex !important; 
                            align-items: center !important; 
                            justify-content: center !important; 
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                          }
                          .chess-pure-text {
                            font-family: 'Chess Merida', serif !important;
                            font-size: var(--diagram-size) !important;
                            line-height: 1.1 !important;
                            white-space: pre !important;
                            color: #000000 !important;
                            display: block !important;
                            background: transparent !important;
                            text-align: center !important;
                            margin: 0 auto !important;
                            overflow: visible !important;
                          }
                          h2 { font-size: 24pt !important; font-weight: bold !important; margin-top: 14pt !important; margin-bottom: 12pt !important; font-family: Georgia, serif !important; page-break-inside: avoid !important; break-inside: avoid !important; }
                          h3 { font-size: 16pt !important; font-weight: bold !important; margin-top: 18pt !important; margin-bottom: 8pt !important; font-family: Georgia, serif !important; page-break-inside: avoid !important; break-inside: avoid !important; }
                          p { margin-bottom: 10pt !important; font-size: 11pt !important; line-height: 1.5 !important; page-break-inside: avoid !important; break-inside: avoid !important; }
                          .show-numbering h2::before { content: "${currentChapterIndex}. " !important; }
                          .show-numbering h3::before { content: counter(section-count) " " !important; }
                          .is-structural-page h2::before, .is-structural-page h3::before { content: none !important; }
                        `
                        clonedDoc.head.appendChild(styleTag)
                    }
                },
                jsPDF: { unit: 'mm' as const, format: pdfFormat, orientation: 'portrait' as const },
                // INTEGRIAMO IL CONTROLLO DI INTERRUZIONE PAGINA CHE MANCAVA NELLA FUNZIONE GLOBALE
                pagebreak: { mode: ['css', 'legacy'] as const, avoid: ['p', 'h1', 'h2', 'h3', '.chess-diagram-container'] }
            }

            console.log(`[PDF LIVE ENGINE] Generazione buffer PDF singolo per "${section.title}"...`);
            const pdfBuffer = await html2pdf().set(options).from(containerClone).outputPdf('arraybuffer')
            pdfBuffers.push(pdfBuffer)
            
            console.log(`[PDF LIVE ENGINE] Buffer completato per "${section.title}": ${pdfBuffer.byteLength} byte.`);
        }

        // 5. COMPILAZIONE GENERALE TRAMITE PDF-LIB
        console.log("[PDF LIVE ENGINE] Fusione finale dei flussi di pagina...");
        const mergedPdf = await PDFDocument.create()
        for (let i = 0; i < pdfBuffers.length; i++) {
            const srcPdf = await PDFDocument.load(pdfBuffers[i])
            console.log(`[PDF LIVE ENGINE] Unione -> ${store.sectionIndex[i].title} pagine totali: ${srcPdf.getPageCount()}`);
            const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices())
            copiedPages.forEach((page) => mergedPdf.addPage(page))
        }

        const mergedPdfBytes = await mergedPdf.save()
        const blob = new Blob([mergedPdfBytes] as BlobPart[], { type: 'application/pdf' })

        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${store.metadata.title.toLowerCase().replace(/\s+/g, '_')}_completo.pdf`
        link.click()
        
        console.log("%c[PDF LIVE ENGINE] --- PROCESSO CONCLUSO CON SUCCESSO ---", "color: #16a34a; font-weight: bold;");

    } catch (error) {
        console.error("[PDF LIVE ENGINE] ERRORE CRITICO:", error)
    } finally {
        // 6. RIPRISTINO DELLO STATO UTENTE ORIGINALMENTE ATTIVO
        store.activeSectionId = originalActiveSectionId
        isGeneratingPdf.value = false
    }
}

// Ascolta lo store Pinia: quando scatta il segnale, inserisce il diagramma col FEN attuale
watch(() => store.insertSignal, () => {
    if (editor.value) {
        editor.value.commands.insertChessDiagram({ fen: store.activeFen })
    }
})

watch(() => store.exportSignal, () => {
    console.log('Segnale di esportazione ricevuto nell\'editor! Avvio generatePdf()...')
    generatePdf()
})

watch(() => store.exportFullBookSignal, () => {
    if (store.exportFullBookSignal === 0) return
    generateFullBookPdf()
})

// Calcola la numerazione corretta del capitolo attivo filtrando solo i tipi 'chapter'
const currentChapterNumber = computed(() => {
    if (!store.activeSectionId) return 1

    // Trova l'elenco di tutti i capitoli fino a quello corrente
    const chapters = store.sectionIndex.filter(s => s.type === 'chapter')
    const currentIndex = chapters.findIndex(s => s.id === store.activeSectionId)

    // Restituisce l'indice basato su 1 (es. Capitolo 1 = 1, Capitolo 2 = 2)
    return currentIndex !== -1 ? currentIndex + 1 : 1
})
</script>

<style>
/* Layout stile Google Docs / Word */
#book-editor-content {
    background-color: #f3f4f6;
    display: block;
    /* Trasformiamo in block anziché flex */
    padding: 2rem;
    overflow-x: auto;
    /* Attiva lo scrollbar orizzontale */
}

.tiptap-container {
    counter-reset: chapter-count var(--chapter-index) section-count 0;
    background: #ffffff;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    border: 1px solid #e5e7eb;
    transition: all 0.3s ease;

    padding: var(--page-margin-top) var(--page-margin-right) var(--page-margin-bottom) var(--page-margin-left);

    width: var(--page-width, 210mm) !important;
    max-width: var(--page-width, 210mm) !important;
    min-width: var(--page-width, 210mm) !important;
    /* Blocca la larghezza */
    min-height: var(--page-height, 297mm);

    /* IL TRUCCO: centra il foglio se c'è spazio; se lo spazio finisce, */
    /* si ancora a sinistra a inizio pagina e permette lo scroll senza tagliare nulla */
    margin: 0 auto 2rem auto;
    box-sizing: border-box;

    /* APPLICHIAMO DUE GRADIENTI COMBINATI CHE COPRONO LE RIGHE DI OGNI PAGINA */
    background-image: 
        linear-gradient(to bottom, 
            transparent calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm) - 1px), 
            #ef4444 calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm) - 1px), 
            #ef4444 calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm) + 1px), 
            transparent calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm) + 1px)
        ),
        linear-gradient(to bottom, 
            transparent 0px, 
            transparent calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm)), 
            #f9fafb calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm)), 
            #f9fafb calc(var(--page-height, 297mm) - 1px),
            #cbd5e1 calc(var(--page-height, 297mm) - 1px), 
            #cbd5e1 var(--page-height, 297mm)
        );

    background-size: 100% var(--page-height, 297mm);
    background-repeat: repeat-y;
    background-position: 0 0;
}

/* Rimuoviamo il focus outline nativo per non rovinare l'effetto foglio */
.tiptap:focus {
    outline: none;
}

.tiptap {
    width: 100%;
    max-width: 100%;
    word-break: break-word;
    /* Forza l'andata a capo del testo lungo */
    overflow-wrap: break-word;
}

.tiptap h2 {
    font-size: 2.25rem;
    font-weight: 700;
    color: #171717;
    margin-bottom: 0.5rem;
    font-family: Georgia, Cambria, serif;
}

/* Mostra il numero del capitolo prima del testo SOLO se è attiva la numerazione */
.show-numbering .tiptap h2[data-toc-level="1"]::before,
.show-numbering .tiptap h2::before {
    content: counter(chapter-count) ". ";
}

.tiptap h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #262626;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    font-family: Georgia, Cambria, serif;
}

/* Se l'H3 ha l'attributo, incrementa e mostra la gerarchia (es. 2.1) */
.tiptap h3[data-toc-level="2"] {
    counter-increment: section-count;
}

.show-numbering .tiptap h3[data-toc-level="2"]::before,
.show-numbering .tiptap h3::before {
    content: counter(chapter-count) "." counter(section-count) " ";
}

.tiptap p {
    margin-bottom: 1.25rem;
}

.tiptap ul {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin-bottom: 1.25rem;
}

/* Stile per gestire il segnaposto (placeholder) della didascalia quando è vuota */
.tiptap p:empty::before,
[placeholder]:empty::before {
    content: attr(placeholder);
    float: left;
    color: #a3a3a3;
    pointer-events: none;
    height: 0;
}

/* Rimuove forzatamente qualsiasi numerazione automatica in Copertina e Indice */
.is-structural-page .tiptap h2::before,
.is-structural-page .tiptap h2[data-toc-level="1"]::before,
.is-structural-page .tiptap h3::before,
.is-structural-page .tiptap h3[data-toc-level="2"]::before {
    content: none !important;
}
</style>