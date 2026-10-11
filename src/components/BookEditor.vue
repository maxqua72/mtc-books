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
        <!-- OVERLAY DI CARICAMENTO PDF -->
        <div v-if="pdfStore.isGeneratingPdf"
            class="absolute inset-0 bg-white/95 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center gap-4">
            <div class="w-12 h-12 border-4 border-neutral-800 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-center">
                <p class="font-semibold text-neutral-800 text-lg">Generazione del PDF sul server in corso...</p>
                <p class="text-sm text-neutral-500 mt-1">Elaborazione dei font e della paginazione con Playwright.</p>
            </div>
        </div>

        <!-- Inserimento della Toolbar Modulare -->
        <EditorToolbar v-if="editor" :editor="editor" :zoom="currentZoomOption" @update:zoom="handleZoomChange"
            @insert-tree-block="insertNewChessTreeBlock" @split-tree-block="handleSplitTreeBlock" />

        <!-- Area di Scrittura Effettiva (Scroll Container) -->
        <div id="book-editor-content" ref="scrollContainer" class="flex-1 overflow-y-auto p-8"
            @click="handleCanvasClick">
            <!-- Contenitore flessibile privo di justify-center per evitare il bug del taglio a sinistra -->
            <div class="editor-scroll-wrapper"
                :style="{ minWidth: currentZoomOption === 'fit-width' ? '0px' : 'min-content' }">

                <!-- Wrapper di Trasformazione Zoom -->
                <div class="zoom-transform-wrapper transition-transform duration-150 ease-out origin-top-left ml-0"
                    :style="{
                        transform: `scale(${computedZoomScale})`,
                        width: `${getPagePixelWidth()}px`,
                        marginBottom: zoomMarginBottom
                    }">
                    <div @click.self="handlePageClick" class="tiptap-container" :class="{
                        'show-numbering': store.metadata.showNumbering,
                        'is-structural-page': store.activeSectionInfo?.type === 'cover' || store.activeSectionInfo?.type === 'index'
                    }" :style="{
                        '--chapter-index': store.currentChapterNumber,
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
import { ChessDiagram } from '../extensions/ChessDiagram.ts'
import { CustomHeading } from '../extensions/CustomHeading' // Aggiusta il percorso se serve
import { ChessTreeBlock } from '../extensions/ChessTreeBlock' // <-- Nuova Estensione Blocco Ibrido
import { ProtectChessNodes } from '../extensions/ProtectChessNodes'
import { DiagramRef } from '../extensions/DiagramRef'
import EditorToolbar from './EditorToolbar.vue'
import Focus from '@tiptap/extension-focus'
import { usePdfStore, type ExportSection } from '../stores/pdfStore'


// @ts-ignore
import html2pdf from 'html2pdf.js'

import pdfPrintStyles from '../assets/styles/pdf-print.css?raw'

const store = useChessBookStore()
const treeStore = useChessTreeStore()
const pdfStore = usePdfStore()

const isGeneratingPdf = ref(false)

const isInsertingFromEngine = ref(false)

// --- GESTIONE ZOOM ---
const currentZoomOption = ref<string>('100')
const computedZoomScale = ref<number>(1)
const scrollContainer = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

// Ritorna la larghezza teorica in pixel per il calcolo di "Adatta Larghezza"
const getPagePixelWidth = () => {
    const format = store.metadata.pageFormat || 'a4'
    if (format === 'crown-quarto') return 714 // ~189mm a 96 DPI
    if (format === 'b-format') return 488     // ~129mm a 96 DPI
    return 793                                // ~210mm A4 a 96 DPI
}

// Ritorna l'altezza della pagina in pixel (a 96 DPI)
const getPagePixelHeight = () => {
    const format = store.metadata.pageFormat || 'a4'
    if (format === 'crown-quarto') return 930  // ~246mm
    if (format === 'b-format') return 748      // ~198mm
    return 1123                                // ~297mm A4
}

// Calcola lo zoom dinamico
const calculateZoom = () => {
    if (currentZoomOption.value === 'fit-width') {
        if (!scrollContainer.value) return

        // clientWidth misura lo spazio visibile escludendo la barra di scorrimento verticale
        const padding = 64 // Margine di sicurezza
        const availableWidth = scrollContainer.value.clientWidth - padding
        const pageWidth = getPagePixelWidth()

        // Calcola il fattore di scala esatto
        //const scale = availableWidth / pageWidth

        // Limitiamo lo zoom minimo/massimo e applichiamo una tolleranza
        //computedZoomScale.value = Math.max(0.3, Math.min(2.5, scale))

        if (availableWidth > 0) {
            const scale = availableWidth / pageWidth
            // Impostiamo un limite minimo (es. 0.35) e massimo (2.5)
            computedZoomScale.value = Math.max(0.35, Math.min(2.5, scale))
        }


    } else {
        computedZoomScale.value = parseFloat(currentZoomOption.value) / 100
    }
}

const handleZoomChange = (newZoom: string) => {
    currentZoomOption.value = newZoom
    //calculateZoom()
    nextTick(() => {
        calculateZoom()
    })
}

// Compensa lo spazio vuoto in basso generato dal ridimensionamento CSS transform
// Compensa l'altezza occupata dal foglio quando scalato
const zoomMarginBottom = computed(() => {
    const pageHeight = getPagePixelHeight()
    const scaledHeight = pageHeight * computedZoomScale.value
    // Se lo zoom è inferiore a 1, riduciamo il margine inferiore per evitare spazio vuoto gigantesco
    const difference = scaledHeight - pageHeight
    return `${difference}px`
})

watch(() => store.metadata.pageFormat, () => {
    calculateZoom()
})

// Gestisce il clic nello spazio vuoto della pagina A4 (sotto l'ultimo paragrafo)
const handlePageClick = (event: MouseEvent) => {
    if (!editor.value) return

    // Porta il focus in fondo al documento se il clic è avvenuto direttamente nel container della pagina
    editor.value.chain().focus('end').run()
}

// Gestisce il clic nello spazio grigio esterno al foglio
const handleCanvasClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    // Se l'utente clicca sul background grigio fuori dal foglio
    if (target.id === 'book-editor-content' || target.classList.contains('editor-scroll-wrapper')) {
        if (!editor.value) return
        editor.value.chain().focus('end').run()
    }
}


const getPageSizeStyles = computed(() => {
    const format = store.metadata.pageFormat || 'a4'

    const formats: Record<string, { width: string; height: string }> = {
        'a4': { width: '210mm', height: '297mm' },
        'crown-quarto': { width: '189mm', height: '246mm' },
        'b-format': { width: '129mm', height: '198mm' }
    }

    return formats[format] || formats['a4']
})

const DEFAULT_CONTENT = `
  <h2>Capitolo 1 — Introduzione</h2>
  <p>Questo è il testo del tuo nuovo libro sugli scacchi. Puoi selezionare il testo per formattarlo in <strong>grassetto</strong> o <em>corsivo</em> utilizzando la toolbar superiore.</p>
  <p>Muovi i pezzi sulla destra per impostare una variante, posiziona il cursore del testo qui sotto e premi il bottone nero sulla console.</p>
`

const editor = useEditor({
    content: store.activeSectionHtml || DEFAULT_CONTENT,
    extensions: [
        StarterKit.configure({
            heading: false // Disabilitiamo sempre l'heading standard per evitare conflitti
        }),
        Focus.configure({
            className: 'is-node-focused', // Classe CSS applicata al blocco/nodo attivo
            mode: 'deepest',              // Applica il focus sul nodo più profondo
        }),
        CustomHeading, // <-- Estensione personalizzata per h2 e h3
        ChessDiagram, // <-- Registriamo l'estensione del nostro diagramma scacchistico
        ChessTreeBlock,
        ProtectChessNodes,
        DiagramRef,
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
        //purgeOrphanTrees()
    }
})

// Comando per creare una nuova istanza di albero mossa e incollarne il relativo tag nel testo
const insertNewChessTreeBlock = () => {
    if (!editor.value) return

    // 1. Genera l'ID unico per l'albero scacchi
    /*
    const uniqueTreeId = `tree_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 2. Crea l'albero nello store di Pinia
    treeStore.trees.push({
        id: uniqueTreeId,
        title: `Albero #${treeStore.trees.length + 1}`,
        startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        rootNodes: [] as any[],
        activeNodeId: null
    })

    // Imposta questo nuovo blocco come attivo nello store
    treeStore.activeTreeId = uniqueTreeId
    */
    const newTree = treeStore.createNewTree(`Albero #${treeStore.trees.length + 1}`)
    const uniqueTreeId = newTree.id
    treeStore.activeNodeId = null

    // 3. Sposta il cursore alla fine del documento e inserisci il blocco scacchi
    editor.value.chain()
        // Sposta il cursore alla fine di tutto per evitare QUALSIASI sovrascrittura
        .focus('end')
        .insertContent([
            {
                type: 'chessTreeBlock',
                attrs: { treeId: uniqueTreeId }
            },
            {
                type: 'paragraph' // Crea una riga vuota sotto per permettere all'utente di continuare a scrivere
            }
        ])
        .run()

    store.activeSectionHtml = editor.value.getHTML()
}

// 2. FONDAMENTALE: Reagisci al ripristino da IndexedDB e al cambio sezione
watch(
    () => store.activeSectionHtml,
    (newHtml) => {
        if (!editor.value) return

        // Ottieni l'HTML attuale di Tiptap
        const currentHtml = editor.value.getHTML()

        // Se l'HTML dello store è diverso da quello nell'editor, aggiornalo
        // Il parametro `false` impedisce a setContent di far scattare di nuovo l'evento onUpdate
        if (newHtml && currentHtml !== newHtml) {
            editor.value.commands.setContent(newHtml, { emitUpdate: false })
        }
    }
)


const loadSectionIntoEditor = (sectionId: string | null) => {
    if (!sectionId || !editor.value) return

    // 1. Recuperiamo le info della sezione corrente
    const currentSection = store.sectionIndex.find(s => s.id === sectionId)

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
      <h1 style="text-align: center; font-size: 32pt; margin-top: 50mm; font-family: Lora, Georgia, serif;">Titolo del Libro</h1>
      <p style="text-align: center; font-style: italic; font-size: 14pt; margin-top: 10mm;">Autore</p>
    `)
        return
    }

    // 4. Per i CAPITOLI normali, sblocchiamo l'editor e carichiamo il loro HTML
    editor.value.setOptions({ editable: true })
    //editor.value.commands.setContent(store.activeSectionHtml)
    // CONTROLLO: Se il capitolo è vuoto o non ha ancora un contenuto reale,
    // inseriamo un h2 vuoto così il CSS mostra subito il numero del capitolo,
    // seguito da un paragrafo vuoto per quando l'utente premerà invio.
    if (!store.activeSectionHtml || store.activeSectionHtml.trim() === '') {
        editor.value.commands.setContent('<h2></h2><p></p>')

        // Opzionale: Sposta automaticamente il cursore all'interno dell'h2 appena creato
        nextTick(() => {
            editor.value?.commands.focus('start')
        })
    } else {
        // Se ha già del testo salvato, lo carichiamo normalmente
        editor.value.commands.setContent(store.activeSectionHtml)
    }
}

// Ascolta se lo store cambia la sezione attiva esternamente (es: all'apertura di un file)
// Ascolta se lo store cambia la sezione attiva esternamente (es: selezione dalla barra laterale)
watch(() => store.activeSectionId, (id) => loadSectionIntoEditor(id))

// L'editor viene creato dopo il montaggio: al primo istante il watcher sopra non scatta
watch(editor, (ed) => {
    if (ed) loadSectionIntoEditor(store.activeSectionId)
}, { immediate: true })

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

    // Osservatore dimensioni per "Adatta larghezza"
    if (scrollContainer.value) {
        resizeObserver = new ResizeObserver(() => {
            if (currentZoomOption.value === 'fit-width') {
                calculateZoom()
            }
        })
        resizeObserver.observe(scrollContainer.value)
    }
    calculateZoom()
})

onBeforeUnmount(() => {
    window.removeEventListener('request-editor-sync', syncEditorContent)
    if (resizeObserver) resizeObserver.disconnect()
    //purgeOrphanTrees()
})

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
    transform: none !important; /* Garantisce la scala nativa WYSIWYG per il PDF */
  }
  .book-text-engine, .tiptap, .book-text-engine p, .tiptap p {
    font-family: Lora,Georgia, Cambria, serif !important;
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
    font-family: Lora, Georgia, serif !important; 
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
    font-family: Lora,Georgia, serif !important; 
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

  /* 1. Nasconde la toolbar delle azioni (bottoni taglia, cestino, matita) */
  .diagram-actions-menu {
    display: none !important;
  }

  /* 1. Contenitore esterno del Badge (rettangolo nero) */
  .diagram-number-badge {
    position: absolute !important;
    top: 30px !important;
    right: 100% !important;
    margin-right: 10px !important;
    
    width: auto !important;
    height: 24px !important;
    min-width: 24px !important;
    background-color: #000000 !important;
    padding: 0 7px !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    
    display: block !important;
  }

  /* 2. Blocco di testo interno (div) con margine / offset controllato */
  .diagram-number-badge .badge-text {
    display: block !important;
    width: 100% !important;
    height: 100% !important;
    
    /* Altezza riga e font leggibile */
    line-height: 24px !important;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-size: 1rem !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    text-align: center !important;
    
    /* Reset assoluto dei margini/padding ereditati */
    margin: -6px 0 0 0 !important;
    padding: 0 !important;
    border: none !important;
    
  }

  /* 3. Stabilizza l'indicatore del tratto */
  .turn-indicator {
    position: absolute !important;
    top: 70px !important;
    right: 100% !important;
    margin-right: 10px !important;
    width: 20px !important;
    height: 20px !important;
    border-radius: 50% !important;
    box-sizing: border-box !important;
  }
  .turn-indicator.white {
    background-color: #ffffff !important;
    border: 2px solid #000000 !important;
  }
  .turn-indicator.black {
    background-color: #000000 !important;
    border: 2px solid #000000 !important;
  }

  /* 4. Resetta completamente la Didascalia (rimuove il box grigio da edit/focus) */
  .diagram-caption,
  .diagram-caption.is-editing,
  .diagram-caption:focus,
  .diagram-caption:hover {
    background-color: transparent !important;
    border-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    font-family: Lora, Georgia, Cambria, serif !important;
    font-size: 9.5pt !important;
    color: #525252 !important;
    font-style: italic !important;
    text-align: center !important;
    margin-top: 0.5rem !important;
    padding: 0 !important;
  }
  .diagram-caption p,
  .diagram-caption div {
    margin: 0 !important;
    padding: 0 !important;
  }
  
  /* STILI DI STAMPA PER IL CHESS TREE BLOCK */
  .chess-tree-block-container {
    border: none !important;
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

const getSharedCssRulesServer = (
    marginTop: number,
    marginRight: number,
    marginBottom: number,
    marginLeft: number,
    pageSize: { width: string; height: string },
    currentChapterIndex: number
) => {
    // Inietta solo le variabili CSS che sovrascrivono i default di pdf-print.css
    const customVariables = `
    :root {
      --page-margin-top: ${marginTop}mm;
      --page-margin-right: ${marginRight}mm;
      --page-margin-bottom: ${marginBottom}mm;
      --page-margin-left: ${marginLeft}mm;
      --page-width: ${pageSize.width};
      --chapter-index: ${currentChapterIndex};
    }
  `

    return `${customVariables}\n${pdfPrintStyles}`
}

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

    // RESETTA TRASFORMAZIONI ZOOM E IMPOSTA DIMENSIONI NATIVE
    containerClone.style.transform = 'none'

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

    const currentChapterIndex = store.currentChapterNumber

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

    // Salviamo l'ID della sezione attualmente visualizzata per ripristinarla alla fine
    const originalActiveSectionId = store.activeSectionId
    const originalContent = editor.value ? editor.value.getHTML() : ''
    isGeneratingPdf.value = true

    console.log("%c[PDF LIVE ENGINE] --- INIZIO ESPORTAZIONE LIBRO COMPLETO ---", "color: #0284c7; font-weight: bold; font-size: 14px;");

    try {
        // 0. SALVATAGGIO PREVENTIVO: Congeliamo subito la sezione attualmente aperta nella cache
        if (originalActiveSectionId) {
            store.zippedSectionsCache[originalActiveSectionId] = JSON.stringify({
                id: originalActiveSectionId,
                html: originalContent
            })
        }

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

            // 1. ESTRAZIONE HTML E CAMBIO DI SEZIONE NELLO STORE
            let sectionHtml = ''

            if (section.type === 'index') {
                sectionHtml = store.generatedTocHtml
            } else {
                const cachedData = store.zippedSectionsCache[section.id]
                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData)
                        sectionHtml = parsed.html || ''
                    } catch (e) {
                        console.error(`[PDF LIVE ENGINE] Errore nel parsing della cache per la sezione ${section.id}:`, e)
                    }
                }
            }

            // Cambiamo la sezione attiva nello store
            store.activeSectionId = section.id
            store.activeSectionHtml = sectionHtml

            // Aggiorniamo Tiptap in modo SINCRONO prima del rendering del DOM
            if (editor.value) {
                editor.value.commands.setContent(sectionHtml, { emitUpdate: false })
            }

            // 2. ATTESA DOPPIA (Vue Tick + Timeout per Tiptap ed estensioni diagrammi)
            await nextTick()
            await new Promise((resolve) => requestAnimationFrame(resolve))
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

            // 4. CLONAZIONE DI SICUREZZA
            const containerClone = originalElement.cloneNode(true) as HTMLElement

            // RESETTA TRASFORMAZIONI ZOOM E IMPOSTA DIMENSIONI NATIVE
            containerClone.style.transform = 'none'

            // BLOCCO DIMENSIONI REALI SUL CLONE IN MILLIMETRI
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

            // Configurazione formati e opzioni
            const isCustomFormat = store.metadata.pageFormat === 'crown-quarto' || store.metadata.pageFormat === 'b-format'
            const pdfFormat: string | [number, number] = isCustomFormat
                ? [parseFloat(pageSize.width), parseFloat(pageSize.height)] as [number, number]
                : 'a4'

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
        if (originalActiveSectionId) {
            await store.changeActiveSection(originalActiveSectionId)
            if (editor.value) {
                editor.value.commands.setContent(store.activeSectionHtml, { emitUpdate: false })
            }
        }
        isGeneratingPdf.value = false
    }
}

const generateFullBookPdf_old = async () => {

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
            await new Promise((resolve) => requestAnimationFrame(resolve))
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

            // RESETTA TRASFORMAZIONI ZOOM E IMPOSTA DIMENSIONI NATIVE
            containerClone.style.transform = 'none'

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
/*
watch(() => store.insertSignal, () => {
    if (editor.value) {
        editor.value.commands.insertChessDiagram({ fen: store.activeFen })
    }
})*/

// NUOVA GESTIONE SPLIT: Chiamata al click su "Dividi Blocco" nella Toolbar
const handleSplitTreeBlock = () => {
    if (!editor.value) return

    const currentTreeId = treeStore.activeTreeId
    const activeNodeId = treeStore.activeNodeId

    if (!currentTreeId || !activeNodeId) return

    // 1. Spezziamo l'albero nello store
    const newTreeId = treeStore.splitTree(currentTreeId, activeNodeId)
    if (!newTreeId) return

    // 2. Troviamo la posizione esatta del blocco corrente in Tiptap
    let targetPos = -1
    editor.value.state.doc.descendants((node, pos) => {
        if (node.type.name === 'chessTreeBlock' && node.attrs.treeId === currentTreeId) {
            targetPos = pos + node.nodeSize
        }
    })

    // 3. Inseriamo SOLTANTO il secondo blocco mosse (senza il diagramma)
    if (targetPos !== -1) {
        editor.value
            ?.chain()
            .setTextSelection(targetPos)
            .insertContent([
                {
                    type: 'chessTreeBlock',
                    attrs: { treeId: newTreeId }
                },
                { type: 'paragraph' } // Riga di testo vuota per continuare a scrivere
            ])
            .run()

        store.activeSectionHtml = editor.value.getHTML()
    }
}

// 1. INSERIMENTO DIAGRAMMA SEMPLICE (Premendo "Inserisci Diagramma" dalla Console Scacchiera)
/*
watch(() => store.insertSignal, () => {
    if (!editor.value) return

    // Inserisce sempre e solo il diagramma visivo nel punto esatto del cursore Tiptap
    editor.value
        .chain()
        .focus()
        .insertChessDiagram({ fen: store.activeFen })
        .insertContent({ type: 'paragraph' })
        .run()

    store.activeSectionHtml = editor.value.getHTML()
})*/

watch(() => store.insertSignal, () => {
    if (!editor.value) return

    try {
        const currentTreeId = treeStore.activeTreeId
        const activeNodeId = treeStore.activeNodeId

        // 🟢 CASO A: Se una mossa dentro un Tree è selezionata
        if (currentTreeId && activeNodeId) {

            // 1. Troviamo l'albero corrente nello store
            const currentTree = treeStore.trees.find(t => t.id === currentTreeId)

            // 2. Chiamiamo il getter passando le rootNodes dell'albero trovato
            const activeNode = currentTree
                ? treeStore.findNodeById(currentTree.rootNodes, activeNodeId)
                : null

            // 3. Verifichiamo in sicurezza se ha mosse successive
            const hasNextMoves = Boolean(activeNode?.children && activeNode.children.length > 0)

            const diagramFen = treeStore.activeFen

            // 4. Troviamo la posizione del blocco chessTreeBlock corrente
            let insertPos = -1
            editor.value.state.doc.descendants((node, pos) => {
                if (node.type.name === 'chessTreeBlock' && node.attrs.treeId === currentTreeId) {
                    insertPos = pos + node.nodeSize
                }
            })

            if (insertPos !== -1) {
                if (hasNextMoves) {
                    // CASO A.1: Mossa INTERMEDIA -> Spezza l'albero e inserisci al centro
                    const newTreeId = treeStore.splitTree(currentTreeId, activeNodeId)
                    if (!newTreeId) return

                    editor.value
                        .chain()
                        .focus()
                        .insertContentAt(insertPos, [
                            { type: 'chessDiagram', attrs: { fen: diagramFen } },
                            { type: 'chessTreeBlock', attrs: { treeId: newTreeId } },
                            { type: 'paragraph' }
                        ])
                        .run()
                } else {
                    // CASO A.2: ULTIMA mossa -> Inserisci il Diagramma SOTTO senza spezzare
                    editor.value
                        .chain()
                        .focus()
                        .insertContentAt(insertPos, [
                            { type: 'chessDiagram', attrs: { fen: diagramFen } },
                            { type: 'paragraph' }
                        ])
                        .run()
                }

                store.activeSectionHtml = editor.value.getHTML()
            }
            return
        }

        // 🔵 CASO B: Nessun tree selezionato -> Inserimento alla posizione corrente del cursore
        editor.value
            .chain()
            .focus()
            .insertChessDiagram({ fen: store.activeFen })
            .insertContent({ type: 'paragraph' })
            .run()

        store.activeSectionHtml = editor.value.getHTML()

    } catch (error) {
        console.error('Errore durante l\'inserimento del diagramma:', error)
    }
})

// Rileva quando viene registrata una nuova mossa sulla scacchiera.
// Poiché le mosse ora vivono solo nel ChessTreeBlock tramite Pinia,
// non dobbiamo più inserire nodi fisici (chessMove/chessVariant) nel documento di Tiptap.
watch(() => treeStore.lastRecordedMoveSignal, (moveSignal) => {
    if (!moveSignal) return

    // Ci limitiamo a consumare e azzerare il segnale dello store.
    // L'albero delle mosse nel ChessTreeBlock si aggiornerà da solo reattivamente
    // grazie al rendering di ChessMoveRenderer.vue.
    treeStore.lastRecordedMoveSignal = null
})

// Consuma semplicemente il segnale di eliminazione mossa senza toccare il testo di Tiptap
watch(() => treeStore.lastDeletedMoveId, (idToDelete) => {
    if (!idToDelete) return
    treeStore.lastDeletedMoveId = null
})

watch(() => store.exportSignal, () => {
    console.log('Segnale di esportazione ricevuto nell\'editor! Avvio generatePdf()...')
    generatePdf()
})

watch(() => store.exportFullBookSignal, () => {
    if (store.exportFullBookSignal === 0) return
    generateFullBookPdf()
})

// Ascolta il segnale per l'esportazione capitolo via Server
watch(() => store.exportServerChapterSignal, () => {
    generateServerChapterPdf()
})

// Ascolta il segnale per l'esportazione libro completo via Server
watch(() => store.exportServerFullBookSignal, () => {
    generateServerFullBookPdf()
})

// Calcola la numerazione corretta del capitolo attivo filtrando solo i tipi 'chapter'
/*const currentChapterNumber = computed(() => {
    if (!store.activeSectionId) return 1

    // Trova l'elenco di tutti i capitoli fino a quello corrente
    const chapters = store.sectionIndex.filter(s => s.type === 'chapter')
    const currentIndex = chapters.findIndex(s => s.id === store.activeSectionId)

    // Restituisce l'indice basato su 1 (es. Capitolo 1 = 1, Capitolo 2 = 2)
    return currentIndex !== -1 ? currentIndex + 1 : 1
})*/



// GESTIONE CREAZIONE PDF TRAMITE SERVER
// Helper per raccogliere le regole CSS dinamiche correnti
const getComputedCssRules = (currentChapterIndex: number) => {
    const pageSize = getPageSizeStyles.value
    const marginTop = store.metadata.pageMarginTop || 25
    const marginRight = store.metadata.pageMarginRight || 20
    const marginBottom = store.metadata.pageMarginBottom || 25
    const marginLeft = store.metadata.pageMarginLeft || 20

    // Combina le regole CSS condivise definite in getSharedCssRules
    //return getSharedCssRules(marginTop, marginRight, marginBottom, marginLeft, pageSize, currentChapterIndex)
    return getSharedCssRulesServer(marginTop, marginRight, marginBottom, marginLeft, pageSize, currentChapterIndex)
}

/**
 * METODO 1: Esportazione Capitolo Singolo
 */
/*
const generateServerChapterPdf = async () => {
  if (!editor.value) return

  const currentChapterIndex = store.currentChapterNumber
  const customCss = getComputedCssRules(currentChapterIndex)
  const title = store.activeSectionInfo?.title || 'capitolo'

  try {
    await pdfStore.exportCurrentChapter({
      htmlContent: editor.value.getHTML(),
      customCss,
      title,
      pageSize: store.metadata.pageFormat || 'a4'
    })
  } catch (err) {
    alert("Si è verificato un errore durante l'esportazione del capitolo.")
  }
}*/
const generateServerChapterPdf = async () => {
    if (!editor.value) return

    const currentChapterIndex = store.currentChapterNumber
    const customCss = getComputedCssRules(currentChapterIndex)
    const title = store.activeSectionInfo?.title || 'capitolo'

    // --- PUNTO 2: CATTURA DEL DOM REALE ---
    // Selezioniamo il contenitore HTML dell'editor visibile nella pagina
    const editorEl = document.querySelector('.tiptap') || document.querySelector('.ProseMirror')

    if (!editorEl) {
        alert("Impossibile trovare il contenuto dell'editor da esportare.")
        return
    }

    // Cloniamo il nodo DOM per poterlo manipolare senza toccare l'interfaccia dell'utente
    const clonedEditor = editorEl.cloneNode(true) as HTMLElement

    // Rimuoviamo elementi d'interfaccia/hover non voluti per la stampa (es. header con bottone "Elimina")
    clonedEditor.querySelectorAll('.block-header, .diagram-actions-menu').forEach(el => el.remove())


    // 2. Svuota il testo contenuto nei badge per evitare la duplicazione con ::before
    clonedEditor.querySelectorAll('.badge-text').forEach(el => {
        el.textContent = ''
    })

    // Estraiamo l'HTML reale con tutti i componenti Vue espanse/renderizzate
    const processedHtml = clonedEditor.innerHTML
    // --------------------------------------

    console.log('Exporting chapter ' + currentChapterIndex + ' with title: ' + title)

    try {
        await pdfStore.exportCurrentChapter({
            htmlContent: processedHtml, // Passiamo l'HTML processato invece di editor.value.getHTML()
            customCss,
            title,
            chapterNumber: currentChapterIndex,
            pageSize: store.metadata.pageFormat || 'a4'
        })
    } catch (err) {
        alert("Si è verificato un errore durante l'esportazione del capitolo.")
    }
}

/**
 * METODO 2: Esportazione Libro Completo
 */
/*
const generateServerFullBookPdf = async () => {
  if (store.sectionIndex.length === 0) {
    alert("Nessun capitolo presente da esportare.")
    return
  }

  // Prepara l'elenco delle sezioni leggendo le righe aggiornate dallo store/cache
  const preparedSections = store.sectionIndex.map((section, index) => {
    let sectionHtml = ''
    if (section.type === 'index') {
      sectionHtml = store.generatedTocHtml
    } else {
      const cachedData = store.zippedSectionsCache[section.id]
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData)
          sectionHtml = parsed.html || ''
        } catch (e) {
          console.error(`Errore parsing cache sezione ${section.id}:`, e)
        }
      } else if (section.id === store.activeSectionId && editor.value) {
        sectionHtml = editor.value.getHTML()
      }
    }

    return {
      id: section.id,
      title: section.title,
      type: section.type,
      html: sectionHtml
    }
  })

  const customCss = getComputedCssRules(1)

  try {
    await pdfStore.exportFullBook({
      sections: preparedSections,
      customCss,
      bookTitle: store.metadata.title || 'libro',
      pageSize: store.metadata.pageFormat || 'a4'
    })
  } catch (err) {
    alert("Si è verificato un errore durante l'esportazione del libro completo.")
  }
}*/

/*
const generateServerFullBookPdf = async () => {
  if (store.sectionIndex.length === 0) {
    alert("Nessun capitolo presente da esportare.")
    return
  }

  // Memorizziamo l'id del capitolo attivo per ripristinarlo alla fine
  const originalSectionId = store.activeSectionId
  
  // Attiviamo l'overlay visivo
  isGeneratingPdf.value = true

  const preparedSections = []

  try {
    for (const section of store.sectionIndex) {
      let sectionHtml = ''

      if (section.type === 'index') {
        sectionHtml = store.generatedTocHtml
      } else {
        // 1. Carichiamo la sezione nell'editor (questo cambia store.activeSectionId e carica il contenuto Tiptap)
        if (store.activeSectionId !== section.id) {
          await store.changeActiveSection(section.id)
          // Cambia questa chiamata con il tuo metodo dello store per cambiare capitolo
        }

        // 2. Attendiamo che Vue aggiorni il DOM
        await nextTick()

        // 3. Piccola pausa di sicurezza (50ms - 100ms) per permettere ai componenti Vue/Tree/Chessboard di essere renderizzati completamente
        await new Promise(resolve => setTimeout(resolve, 100))

        // 4. Catturiamo il DOM Reale con il Tree renderizzato
        sectionHtml = captureCurrentEditorHtml()
      }

      preparedSections.push({
        id: section.id,
        title: section.title,
        type: section.type,
        html: sectionHtml
      })
    }

    // Ripristiniamo la sezione iniziale dell'utente
    if (originalSectionId && store.activeSectionId !== originalSectionId) {
      await store.changeActiveSection(originalSectionId)
      await nextTick()
    }

    const currentChapterIndex = store.currentChapterNumber
    const customCss = getComputedCssRules(currentChapterIndex)

    // Inviamo tutte le sezioni complete di DOM reale al server PDF
    await pdfStore.exportFullBook({
      sections: preparedSections,
      customCss,
      bookTitle: store.metadata.title || 'libro',
      pageSize: store.metadata.pageFormat || 'a4'
    })

  } catch (err) {
    console.error("Errore esportazione libro:", err)
    alert("Si è verificato un errore durante l'esportazione del libro completo.")
  } finally {
    // Nascondiamo l'overlay
    isGeneratingPdf.value = false
  }
}
*/

// Attende che l'editor abbia renderizzato la sezione appena caricata.
// Va chiamato dopo changeActiveSection: dopo il nextTick i watcher hanno già fatto setContent,
// quindi il documento ProseMirror è quello nuovo e possiamo contare i blocchi attesi.
const waitForSectionRender = async (timeoutMs = 4000) => {
    const raf = () => new Promise<void>(r => requestAnimationFrame(() => r()))
    await nextTick()

    const start = performance.now()
    while (performance.now() - start < timeoutMs) {
        const expected = getActiveTreeIds().length
        const rendered = editor.value
            ? editor.value.view.dom.querySelectorAll('.chess-tree-block-container').length
            : 0
        if (expected === rendered) break
        await raf()
    }

    await document.fonts.ready   // i font Merida/Cases devono essere pronti per la misura del DOM
    await raf()
    await raf()
}
const captureCurrentEditorHtml = (chapterNumber: number): string => {
    const editorEl = document.querySelector('.tiptap') || document.querySelector('.ProseMirror')
    if (!editorEl) return ''

    // Clona il nodo visivo renderizzato
    const clonedEditor = editorEl.cloneNode(true) as HTMLElement

    // Rimuove bottoni di azione e menu
    clonedEditor.querySelectorAll('.block-header, .diagram-actions-menu').forEach(el => el.remove())

    // Svuota i badge per evitare duplicazioni visive
    clonedEditor.querySelectorAll('.badge-text').forEach(el => {
        el.textContent = ''
    })

    // Assicura che l'elemento clonato contenga la variabile CSS per il numero di capitolo corrente
    clonedEditor.style.setProperty('--chapter-index', chapterNumber.toString())

    return clonedEditor.innerHTML
}
/* 
const generateServerFullBookPdf = async () => {
    if (store.sectionIndex.length === 0) {
        alert("Nessun capitolo presente da esportare.")
        return
    }

    const originalSectionId = store.activeSectionId
    isGeneratingPdf.value = true

    const preparedSections = []
    let chapterCounter = 0 // Contatore progressivo per i soli capitoli

    try {
        for (const section of store.sectionIndex) {
            let sectionHtml = ''

            // Incrementa il contatore solo per le sezioni che sono capitoli effettivi
            if (section.type === 'chapter') {
                chapterCounter++
            }

            if (section.type === 'index') {
                sectionHtml = store.generatedTocHtml
            } else {
                // 1. Carica la sezione nell'editor
                if (store.activeSectionId !== section.id) {
                    await store.changeActiveSection(section.id)
                }

                // 2. Attendi il rendering di Vue
                await nextTick()
                await new Promise(resolve => setTimeout(resolve, 100))

                // 3. Cattura l'HTML passando il numero di capitolo corrente
                sectionHtml = captureCurrentEditorHtml(chapterCounter)
            }

            preparedSections.push({
                id: section.id,
                title: section.title,
                type: section.type,
                chapterNumber: chapterCounter, // Utile se il backend accetta il numero capitolo per sezione
                html: sectionHtml
            })
        }

        // Ripristina la sezione iniziale dell'utente
        if (originalSectionId && store.activeSectionId !== originalSectionId) {
            await store.changeActiveSection(originalSectionId)
            await nextTick()
        }

        // Genera il CSS globale (o passa le regole base)
        const customCss = getComputedCssRules(1)

        // Invia i dati al backend
        await pdfStore.exportFullBook({
            sections: preparedSections,
            customCss,
            bookTitle: store.metadata.title || 'libro',
            pageSize: store.metadata.pageFormat || 'a4'
        })

    } catch (err) {
        console.error("Errore esportazione libro:", err)
        alert("Si è verificato un errore durante l'esportazione del libro completo.")
    } finally {
        isGeneratingPdf.value = false
    }
} */
const generateServerFullBookPdf = async () => {
    if (isGeneratingPdf.value) return   // evita due export concorrenti (doppio click)
    if (store.sectionIndex.length === 0) {
        alert("Nessun capitolo presente da esportare.")
        return
    }

    const orphans = store.unresolvedDiagramRefs.length
    if (orphans > 0 && !confirm(
        `Ci sono ${orphans} riferimenti a diagrammi che non esistono più (compaiono come "?"). Esportare comunque?`
    )) return

    isGeneratingPdf.value = true
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
        // 0. CONGELA il capitolo attivo (editor -> store -> cache, con html e alberi)
        //    Senza questo passaggio le modifiche recenti andrebbero perse al ripristino finale.
        window.dispatchEvent(new CustomEvent('request-editor-sync'))
        if (store.activeSectionInfo?.type !== 'index') {
            store.syncActiveSectionToCache()
        }

        const preparedSections: ExportSection[] = []
        let chapterCounter = 0

        for (const section of store.sectionIndex) {
            if (section.type === 'chapter') chapterCounter++

            let sectionHtml = ''
            if (section.type === 'index') {
                sectionHtml = store.generatedTocHtml
            } else {
                if (store.activeSectionId !== section.id) {
                    // Senza contenuto: la sezione in uscita è già in cache
                    await store.changeActiveSection(section.id)
                }
                await waitForSectionRender()
                sectionHtml = captureCurrentEditorHtml(chapterCounter)
            }

            preparedSections.push({
                id: section.id,
                title: section.title,
                type: section.type,
                chapterNumber: chapterCounter,
                html: sectionHtml
            })
        }

        // Riporta l'utente dov'era PRIMA della chiamata di rete (che può essere lunga)
        await restoreOriginalSection()

        await pdfStore.exportFullBook({
            sections: preparedSections,
            customCss: getComputedCssRules(1),
            bookTitle: store.metadata.title || 'libro',
            pageSize: store.metadata.pageFormat || 'a4'
        })
    } catch (err) {
        console.error("Errore esportazione libro:", err)
        alert("Si è verificato un errore durante l'esportazione del libro completo.")
    } finally {
        await restoreOriginalSection()   // se qualcosa è fallito a metà, ripristina comunque
        isGeneratingPdf.value = false
    }
}

/**
 * Raccoglie tutti i treeId dai nodi 'chessTreeBlock' attualmente presenti nell'editor
 */
const getActiveTreeIds = (): string[] => {
    if (!editor.value) return []

    const activeIds: string[] = []

    // Scansiona l'albero sintattico di ProseMirror/Tiptap
    editor.value.state.doc.descendants((node) => {
        if (node.type.name === 'chessTreeBlock' && node.attrs.treeId) {
            activeIds.push(node.attrs.treeId)
        }
    })

    return activeIds
}

/**
 * Esegue la pulizia automatica degli alberi orfani
 */
const purgeOrphanTrees = () => {
    const activeIds = getActiveTreeIds()
    treeStore.cleanOrphanTrees(activeIds)
}

// -------------------------------------------------------------
// PUNTI DI AGGANCIO (Dove chiamare purgeOrphanTrees):
// -------------------------------------------------------------

// 1. Prima di salvare il capitolo/libro sul database
// onBeforeUnmount(() => {
//  purgeOrphanTrees()
//})



</script>

<style>
/* Layout stile Google Docs / Word */
#book-editor-content {
    background-color: #f3f4f6;
    display: block;
    width: 100%;
    box-sizing: border-box;
}

/* Wrapper per la centratura sicura in caso di overflow */
.editor-scroll-wrapper {
    display: flex;
    flex-direction: column;
    /*align-items: center;*/
    /* Centra l'elemento solo lungo l'asse verticale/orizzontale senza tagliare a sinistra */
    align-items: flex-start;
    /* CAMBIATO: da 'center' a 'flex-start' per ancorare a sinistra */
    min-width: min-content;
    /* Permette all'elemento di espandere il contenitore nativo di scorrimento */
    width: 100%;
}

.zoom-transform-wrapper {
    /*margin: 0 auto; */
    /* Centra automaticamente quando c'è spazio sufficiente */
    margin-left: 0 !important;
    /* CAMBIATO: rimuove la centratura orizzontale automatica */
    margin-right: auto !important;
    box-sizing: border-box;
    will-change: transform;
}

/* Stili Tipografici Assoluti in punti (pt) condivisi nativamente con l'editor */
.book-text-engine,
.tiptap {
    font-family: Lora, Georgia, Cambria, serif !important;
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

    margin: 0 auto 2rem 0 !important;
    box-sizing: border-box;

    /* Posizionamento millimetrico esatto dell'area grigia di overflow */
    /*
    background-image:
        linear-gradient(to bottom,
            transparent calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm) - 1px),
            #ef4444 calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm) - 1px),
            #ef4444 calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm) + 1px),
            transparent calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm) + 1px)),
        linear-gradient(to bottom,
            transparent 0px,
            transparent calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm)),
            #f9fafb calc(var(--page-height, 297mm) - var(--page-margin-bottom, 25mm)),
            #f9fafb calc(var(--page-height, 297mm) - 1px),
            #cbd5e1 calc(var(--page-height, 297mm) - 1px),
            #cbd5e1 var(--page-height, 297mm));

    background-size: 100% var(--page-height, 297mm);
    background-repeat: repeat-y;
    background-position: 0 0; */
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

/* Applica il rientro della prima riga ai paragrafi standard dell'editor */
.tiptap p,
.ProseMirror p {
    text-indent: 0em;
    /* Regola il valore (es. 1.5em o 20px) in base alle tue preferenze */
}

/* IMPORTANTE: Rimuovi il rientro dai paragrafi che si trovano dentro nodi personalizzati 
   o strutture speciali (es. il tuo blocco scacchi) per evitare conflitti visivi */
.tiptap [data-type="chess-tree-block"] p,
.ProseMirror [data-type="chess-tree-block"] p {
    text-indent: 0;
}

/* Personalizzazione Caret (Cursore di Scrittura) */
.ProseMirror {
    caret-color: #2563eb !important;
    /* Cursore blu visibile ed elegante */
}

/* Quando l'editor è in focus, assicura che il cursore sia sempre visibile e marcato */
.ProseMirror-focused {
    outline: none !important;
}

/* Indicatore discreto di blocco/paragrafo attivo (Stile Google Docs / Notion) */
.ProseMirror p.is-node-focused,
.ProseMirror h2.is-node-focused,
.ProseMirror h3.is-node-focused {
    position: relative;
    background-color: rgba(239, 246, 255, 0.4);
    /* Un leggerissimo azzurro di background */
    border-radius: 2px;
}

/* Linea di focus laterale sul paragrafo/blocco in cui si trova il cursore */
.ProseMirror p.is-node-focused::before,
.ProseMirror h2.is-node-focused::before,
.ProseMirror h3.is-node-focused::before {
    content: '';
    position: absolute;
    left: -12px;
    top: 0;
    bottom: 0;
    width: 3px;
    background-color: #3b82f6;
    border-radius: 2px;
}

/* Gestione paragrafi vuoti: mostra un segnaposto se il blocco vuoto ha il focus */
.ProseMirror p.is-empty.is-node-focused::after {
    content: 'Inizia a digitare qui...';
    color: #9ca3af;
    float: left;
    height: 0;
    pointer-events: none;
    font-style: italic;
}
</style>