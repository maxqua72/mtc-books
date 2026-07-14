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
        <EditorToolbar v-if="editor" :editor="editor" @insert-tree-block="insertNewChessTreeBlock"/>

        <!-- Area di Scrittura Effettiva -->
        <div id="book-editor-content" class="flex-1 overflow-y-auto">
            
            <!-- Pulsante rapido integrato sopra la pagina per i test -->
            <div class="max-w-[210mm] mx-auto mb-2 flex justify-end">
                <button 
                    @click="insertNewChessTreeBlock"
                    class="bg-neutral-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm hover:bg-neutral-700 transition"
                >
                    + Inserisci Blocco Partita / Varianti
                </button>
            </div>
            
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
import { useChessTreeStore } from '../stores/chessTreeStore' 
import { ChessDiagram } from '../extensions/ChessDiagram'
import { CustomHeading } from '../extensions/CustomHeading' // Aggiusta il percorso se serve
import { ChessTreeBlock } from '../extensions/ChessTreeBlock' // <-- Nuova Estensione Blocco Ibridoimport EditorToolbar from './EditorToolbar.vue'
import EditorToolbar from './EditorToolbar.vue'

// @ts-ignore
import html2pdf from 'html2pdf.js'

const store = useChessBookStore()
const treeStore = useChessTreeStore()
const isGeneratingPdf = ref(false)

const isInsertingFromEngine = ref(false)

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
        ChessTreeBlock,
    ],
    editorProps: {
        attributes: {
            class: 'book-text-engine focus:outline-none max-w-none',
        },
    },
    // Aggiorna lo store locale durante la digitazione per l'auto-save temporaneo
    onUpdate({ editor }) {
        if (isInsertingFromEngine.value) return
        store.activeSectionHtml = editor.getHTML()
    }
})

// Comando per creare una nuova istanza di albero mossa e incollarne il relativo tag nel testo
const insertNewChessTreeBlock = () => {
    if (!editor.value) return

    // 1. Genera una nuova partita/albero nello store globale di Pinia
    const uniqueTreeId = `tree_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    treeStore.trees.push({
        id: uniqueTreeId,
        title: `Analisi Partita #${treeStore.trees.length + 1}`,
        startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // <-- Posizione iniziale standard
        rootNodes: [] as any[] // <-- Cast a any[] o al tuo tipo ChessMoveNode[] per evitare 'never[]'
    })

    // 2. Rende questo albero l'albero attivo su cui la scacchiera scriverà d'ora in poi
    treeStore.activeTreeId = uniqueTreeId
    treeStore.activeNodeId = null

    // 3. Inserisce l'oggetto strutturato dentro l'editor Tiptap alla posizione corrente del cursore
    editor.value.chain().focus().insertContent({
        type: 'chessTreeBlock',
        attrs: { treeId: uniqueTreeId }
    }).run()
    
    // Aggiorna lo store
    store.activeSectionHtml = editor.value.getHTML()
}


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
      <h1 style="text-align: center; font-size: 32pt; margin-top: 50mm; font-family: Georgia, serif;">Titolo del Libro</h1>
      <p style="text-align: center; font-style: italic; font-size: 14pt; margin-top: 10mm;">Autore</p>
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


// CSS Unificato e Condiviso iniettato dinamicamente per l'esportazione delle pagine
/*
const getSharedCssRules = (marginTop: number, marginRight: number, marginBottom: number, marginLeft: number, pageSize: { width: string; height: string }, currentChapterIndex: number) => `
  * {
    box-sizing: border-box !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
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
  }
  .book-text-engine, .tiptap, .book-text-engine p, .tiptap p {
    font-family: Georgia, Cambria, serif !important;
    color: #171717 !important;
    font-size: 11pt !important;
    line-height: 1.5 !important;
  }
  .book-text-engine p, .tiptap p {
    display: block !important;
    margin-top: 0 !important;
    margin-bottom: 4.5mm !important;
    padding: 0 !important;
  }
  .book-text-engine h2, .tiptap h2 { 
    font-size: 24pt !important; 
    line-height: 1.2 !important;
    font-weight: bold !important; 
    margin-top: 0 !important;
    margin-bottom: 6mm !important;
    padding: 0 !important;
    font-family: Georgia, serif !important; 
    page-break-inside: avoid !important; 
    break-inside: avoid !important; 
  }

   .tiptap > div > h2:first-child,
  .book-text-engine h2:first-child,
  .tiptap h2:first-child {
    margin-top: -5mm !important; 
  }
  .book-text-engine h3, .tiptap h3 { 
    font-size: 15pt !important; 
    line-height: 19pt !important;
    font-weight: bold !important; 
    margin-top: 18pt !important; 
    margin-bottom: 9pt !important; 
    font-family: Georgia, serif !important; 
    page-break-inside: avoid !important; 
    break-inside: avoid !important; 
  }
  .chess-diagram-container { 
    display: flex !important; 
    align-items: center !important; 
    justify-content: center !important;
    margin-top: 5mm !important;
    margin-bottom: 5mm !important;
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
  .show-numbering h2::before { content: "${currentChapterIndex}. " !important; }
  .show-numbering h3::before { content: counter(section-count) " " !important; }
  .is-structural-page h2::before, .is-structural-page h3::before { content: none !important; }
`
*/
const getSharedCssRules = (marginTop: number, marginRight: number, marginBottom: number, marginLeft: number, pageSize: { width: string; height: string }, currentChapterIndex: number) => `
  * {
    box-sizing: border-box !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
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
  }
  .book-text-engine, .tiptap, .book-text-engine p, .tiptap p {
    font-family: Georgia, Cambria, serif !important;
    color: #171717 !important;
    font-size: 11pt !important;
    line-height: 1.5 !important;
  }
  .book-text-engine p, .tiptap p {
    display: block !important;
    margin-top: 0 !important;
    margin-bottom: 4.5mm !important;
    padding: 0 !important;
  }
  .book-text-engine h2, .tiptap h2 { 
    font-size: 24pt !important; 
    line-height: 1.2 !important;
    font-weight: bold !important; 
    margin-top: 0 !important;
    margin-bottom: 6mm !important;
    padding: 0 !important;
    font-family: Georgia, serif !important; 
    page-break-inside: avoid !important; 
    break-inside: avoid !important; 
  }
  .tiptap > div > h2:first-child,
  .book-text-engine h2:first-child,
  .tiptap h2:first-child {
    margin-top: -5mm !important; 
  }
  .book-text-engine h3, .tiptap h3 { 
    font-size: 15pt !important; 
    line-height: 19pt !important;
    font-weight: bold !important; 
    margin-top: 18pt !important; 
    margin-bottom: 9pt !important; 
    font-family: Georgia, serif !important; 
    page-break-inside: avoid !important; 
    break-inside: avoid !important; 
  }
  .chess-diagram-container { 
    display: flex !important; 
    align-items: center !important; 
    justify-content: center !important;
    margin-top: 5mm !important;
    margin-bottom: 5mm !important;
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
  
  /* STILI DI STAMPA PER IL CHESS TREE BLOCK */
  .chess-tree-block-container {
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    margin: 4mm 0 !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .block-header .delete-btn {
    display: none !important; /* Nasconde il tasto elimina sui fogli PDF generati */
  }
  .comment-input {
    border: none !important;
    pointer-events: none !important; /* Congela gli input di commento */
  }
  .move-comment-box.is-empty {
    display: none !important; /* Nasconde i campi vuoti "Aggiungi commento..." */
  }

  .show-numbering h2::before { content: "${currentChapterIndex}. " !important; }
  .show-numbering h3::before { content: counter(section-count) " " !important; }
  .is-structural-page h2::before, .is-structural-page h3::before { content: none !important; }
`

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

    const currentChapterIndex = currentChapterNumber.value

    const options = {
        margin: [0, 0, 0, 0] as [number, number, number, number],
        filename: `${store.activeSectionInfo?.title || 'capitolo'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollY: 0,
            letterRendering: true, // Forza il motore a calcolare lo spazio esatto di ogni lettera
            onclone: (clonedDoc: Document) => {
                // Rimuove i margini fantasma del body nel PDF
                if (clonedDoc.body) {
                    clonedDoc.body.style.margin = '0 !important';
                    clonedDoc.body.style.padding = '0 !important';
                }
                const styleTag = clonedDoc.createElement('style')
                styleTag.innerHTML = getSharedCssRules(marginTop, marginRight, marginBottom, marginLeft, pageSize, currentChapterIndex)
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
                    letterRendering: true, // Forza il motore a calcolare lo spazio esatto di ogni lettera
                    onclone: (clonedDoc: Document) => {
                        // Rimuove i margini fantasma del body nel PDF
                        if (clonedDoc.body) {
                            clonedDoc.body.style.margin = '0 !important';
                            clonedDoc.body.style.padding = '0 !important';
                        }
                        const styleTag = clonedDoc.createElement('style')
                        styleTag.innerHTML = getSharedCssRules(marginTop, marginRight, marginBottom, marginLeft, pageSize, currentChapterIndex)
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

// Ascolta l'albero delle mosse: quando viene registrata una nuova mossa sulla scacchiera, la inserisce nell'editor
watch(() => treeStore.lastRecordedMoveSignal, (moveSignal) => {
    if (!moveSignal || !editor.value) return

    // Se il Bianco ('w') muove, è la linea principale ('chessMove').
    // Se muove il Nero ('b') o si apre una deviazione, usiamo 'chessVariant'.
    const type = moveSignal.isVariant ? 'chessVariant' : 'chessMove'
    try {
        isInsertingFromEngine.value = true

        // Controlliamo se la mossa è già presente nel punto in cui si trova il cursore per non duplicarla
        const { selection } = editor.value.state
        const currentNode = editor.value.state.doc.nodeAt(selection.from)
        if (currentNode && currentNode.attrs?.id === moveSignal.id) {
            return
        }

        editor.value.chain().focus().insertContent({
            type: type,
            attrs: {
                id: moveSignal.id,
                san: moveSignal.san,
                color: moveSignal.color,
                moveNumber: moveSignal.moveNumber
            }
        }).run()
    } finally {
        // Rilasciamo il blocco e azzeriamo il segnale
        treeStore.lastRecordedMoveSignal = null
        setTimeout(() => {
            isInsertingFromEngine.value = false
        }, 50)
    }
})

// Ascolta l'albero delle mosse: quando un nodo viene eliminato dallo store,
// l'editor lo cerca nel documento e lo rimuove in autonomia
watch(() => treeStore.lastDeletedMoveId, (idToDelete) => {
  if (!idToDelete || !editor.value) return

  editor.value.commands.command(({ tr }) => {
    let nodePos: number | null = null
    
    // Cerca il nodo nel documento (controllando sia chessMove che chessVariant)
    tr.doc.descendants((node, pos) => {
      if ((node.type.name === 'chessMove' || node.type.name === 'chessVariant') && node.attrs.id === idToDelete) {
        nodePos = pos
        return false // Interrompe la ricerca
      }
    })
    
    if (nodePos !== null) {
      tr.delete(nodePos, nodePos + 1)
      return true
    }
    return false
  })
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

/* Stili Tipografici Assoluti in punti (pt) condivisi nativamente con l'editor */
.book-text-engine,
.tiptap {
    font-family: Georgia, Cambria, serif !important;
    font-size: 11pt !important;
    line-height: 1.5 !important;
    color: #171717 !important;
}

.book-text-engine p,
.tiptap p {
    margin-top: 0 !important;
    margin-bottom: 12pt !important;
    padding: 0 !important;
}

.book-text-engine h2,
.tiptap h2 {
    font-size: 24pt !important;
    line-height: 1.2 !important;
    font-weight: bold !important;
    margin-top: 0 !important;
    margin-bottom: 6mm !important;
    color: #171717 !important;
}

.book-text-engine h3,
.tiptap h3 {
    font-size: 15pt !important;
    line-height: 19pt !important;
    font-weight: bold !important;
    margin-top: 18pt !important;
    margin-bottom: 9pt !important;
    color: #262626 !important;
}

/* Gestione dei Contatori dei Capitoli */
.show-numbering .tiptap h2::before {
    content: counter(chapter-count) ". ";
}
.show-numbering .tiptap h3[data-toc-level="2"] {
    counter-increment: section-count;
}
.show-numbering .tiptap h3::before {
    content: counter(chapter-count) "." counter(section-count) " ";
}
.is-structural-page .tiptap h2::before,
.is-structural-page .tiptap h3::before {
    content: none !important;
}

/* Struttura del Contenitore della Pagina Editor */
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
    min-height: var(--page-height, 297mm);

    margin: 0 auto 2rem auto;
    box-sizing: border-box;

    /* Posizionamento millimetrico esatto dell'area grigia di overflow */
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

.tiptap:focus {
    outline: none;
}

.tiptap {
    width: 100%;
    max-width: 100%;
    word-break: break-word;
    overflow-wrap: break-word;
}
</style>