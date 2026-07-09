<template>
    <div class="flex-1 bg-white border border-neutral-200 rounded-xl flex flex-col shadow-sm overflow-hidden">

        <!-- Inserimento della Toolbar Modulare -->
        <EditorToolbar v-if="editor" :editor="editor" />

        <!-- Area di Scrittura Effettiva -->
        <!-- Area di Scrittura Effettiva -->
        <div id="book-editor-content" class="flex-1 overflow-y-auto">
            <div class="tiptap-container" :class="{
                'show-numbering': store.metadata.showNumbering,
                'is-structural-page': store.activeSectionInfo?.type === 'cover' || store.activeSectionInfo?.type === 'index'
            }" :style="{
                '--chapter-index': currentChapterNumber,
                '--page-width': getPageSizeStyles.width,
                '--page-height': getPageSizeStyles.height,
                '--page-margin-top': '25mm',
                '--page-margin-bottom': '25mm',
                '--page-margin-left': '20mm',
                '--page-margin-right': '20mm'
            }">
                <editor-content :editor="editor" />
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useChessBookStore, type SectionType } from '../stores/chessBookStore'
import { ChessDiagram } from '../extensions/ChessDiagram'
import { CustomHeading } from '../extensions/CustomHeading' // Aggiusta il percorso se serve
import EditorToolbar from './EditorToolbar.vue'

// @ts-ignore
import html2pdf from 'html2pdf.js'

const store = useChessBookStore()

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



const getTemplateForType = (type: SectionType) => {
    if (type === 'cover') return `<h1>Titolo del Libro</h1><p>Autore</p>`;
    if (type === 'index') return `<h2>Indice Generale</h2><div class='toc-placeholder'>Generazione automatica...</div>`;
    return `<h2>Nuovo Capitolo</h2><p>Inizia a scrivere...</p>`;
};

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

const generatePdf = () => {
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

    padding: var(--page-margin-top, 25mm) var(--page-margin-right, 20mm) var(--page-margin-bottom, 25mm) var(--page-margin-left, 20mm);

    width: var(--page-width, 210mm) !important;
    max-width: var(--page-width, 210mm) !important;
    min-width: var(--page-width, 210mm) !important;
    /* Blocca la larghezza */
    min-height: var(--page-height, 297mm);

    /* IL TRUCCO: centra il foglio se c'è spazio; se lo spazio finisce, */
    /* si ancora a sinistra a inizio pagina e permette lo scroll senza tagliare nulla */
    margin: 0 auto 2rem auto;
    box-sizing: border-box;
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