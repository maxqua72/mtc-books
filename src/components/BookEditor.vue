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
        <EditorToolbar v-if="editor" v-show="!isCoverActive" :editor="editor" :zoom="currentZoomOption"
            @update:zoom="handleZoomChange" @insert-tree-block="insertNewChessTreeBlock"
            @split-tree-block="handleSplitTreeBlock" />

        <!-- Copertina: una pagina fissa, non un documento di testo -->
        <CoverEditor v-if="isCoverActive && store.coverModel" v-model="coverProxy" class="flex-1 min-h-0"
            :image-url="store.coverImageUrl" :page-width-mm="coverPageMm.width"
            :page-height-mm="coverPageMm.height" @pick-image="onPickCoverImage"
            @remove-image="store.removeCoverImage()" />


        <!-- Area di Scrittura Effettiva (Scroll Container) -->
        <div v-show="!isCoverActive" id="book-editor-content" ref="scrollContainer" class="flex-1 overflow-y-auto p-8"
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
                        '--page-margin-right': (store.metadata.pageMarginRight || 20) + 'mm',
                        '--paragraph-spacing': bookSpacing.paragraph + 'mm',
                        '--diagram-spacing': bookSpacing.diagram + 'mm',
                        '--variation-spacing': bookSpacing.variation + 'mm',
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
import { watch, onMounted, onBeforeUnmount, computed, ref, nextTick } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { ChessDiagram } from '../extensions/ChessDiagram.ts'
import { CustomHeading } from '../extensions/CustomHeading' // Aggiusta il percorso se serve
import { ChessTreeBlock } from '../extensions/ChessTreeBlock' // <-- Nuova Estensione Blocco Ibrido
import { ProtectChessNodes } from '../extensions/ProtectChessNodes'
import { PgnInsertMarker } from '../extensions/PgnInsertMarker'
import type { Node as PMNode } from '@tiptap/pm/model'

import { DiagramRef } from '../extensions/DiagramRef'
import EditorToolbar from './EditorToolbar.vue'
import CoverEditor from './cover/CoverEditor.vue'
import { getPageSizeMm, type BookCover } from '../utils/cover'
import Focus from '@tiptap/extension-focus'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { usePdfStore, type ExportSection } from '../stores/pdfStore'
import { usePgnImportStore, type PgnPlacement } from '../stores/pgnImportStore'


import pdfPrintStyles from '../assets/styles/pdf-print.css?raw'

const store = useChessBookStore()
const treeStore = useChessTreeStore()
const pdfStore = usePdfStore()
const pgnStore = usePgnImportStore()

const isGeneratingPdf = ref(false)

const isInsertingFromEngine = ref(false)

// --- COPERTINA ---
const isCoverActive = computed(() => store.activeSectionInfo?.type === 'cover')
const coverPageMm = computed(() => getPageSizeMm(store.metadata.pageFormat))
const coverProxy = computed<BookCover>({
    get: () => store.coverModel as BookCover,
    set: (v) => { store.coverModel = v }
})

const onPickCoverImage = async (file: File) => {
    try {
        await store.setCoverImage(file)
    } catch (err: any) {
        alert(err?.message || "Impossibile caricare l'immagine.")
    }
}

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
const handlePageClick = () => {
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

const clampSpacing = (v: unknown, def: number) => {
    if (v === '' || v === null || v === undefined) return def
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(30, Math.max(0, n)) : def
}

const bookSpacing = computed(() => ({
    paragraph: clampSpacing(store.metadata.paragraphSpacing, 4.5),
    diagram: clampSpacing(store.metadata.diagramSpacing, 5),
    variation: clampSpacing(store.metadata.variationSpacing, 4),
}))

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
        TextStyle,
        Color,
        CustomHeading, // <-- Estensione personalizzata per h2 e h3
        ChessDiagram, // <-- Registriamo l'estensione del nostro diagramma scacchistico
        ChessTreeBlock,
        ProtectChessNodes,
        DiagramRef,
        PgnInsertMarker,
    ],
    editorProps: {
        attributes: {
            class: 'book-text-engine focus:outline-none max-w-none',
        },
        // Click nel testo fuori da alberi e diagrammi: si torna in modalità libera
        handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement | null
            if (target && !target.closest('.chess-tree-block-container, .chess-diagram-container')) {
                treeStore.deactivateTree()
            }
            return false
        },
    },
    // Aggiorna lo store locale durante la digitazione per l'auto-save temporaneo
    onUpdate({ editor }) {
        if (isInsertingFromEngine.value) return
        store.activeSectionHtml = editor.getHTML()
    },
    // Se l'albero attivo non è più nel documento (cancellazione, undo, cambio capitolo) si torna in modalità libera
    onTransaction({ editor, transaction }) {
        if (transaction.docChanged && treeStore.activeTreeId &&
            !treeIdsInDoc(editor.state.doc).includes(treeStore.activeTreeId)) {
            treeStore.deactivateTree()
        }
    }
})

// Toolbar "Albero di mosse": nuovo albero in fondo al capitolo, che parte dalla posizione corrente della scacchiera
const insertNewChessTreeBlock = () => {
    if (!editor.value || store.activeSectionInfo?.type !== 'chapter') return
    const tree = treeStore.buildTree(`Albero #${treeStore.trees.length + 1}`)
    pgnStore.addTrees([tree], 'end')
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

    // 3. La COPERTINA è gestita da CoverEditor: l'editor di testo non va toccato
    if (currentSection?.type === 'cover') return

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
/*watch(() => store.generatedTocHtml, (newTocHtml) => {
    const currentSection = store.sectionIndex.find(s => s.id === store.activeSectionId)
    if (currentSection?.type === 'index' && editor.value) {
        editor.value.commands.setContent(newTocHtml)
    }
})*/
watch(
    () => store.activeSectionInfo?.type === 'index' ? store.generatedTocHtml : null,
    (toc) => {
        if (toc && editor.value) editor.value.commands.setContent(toc, { emitUpdate: false })
    }
)

// Sincronizza l'HTML prima del salvataggio definitivo su file
const syncEditorContent = () => {
    // Con la copertina attiva l'editor di testo contiene un vecchio capitolo: non va sincronizzato
    if (editor.value && store.activeSectionInfo?.type !== 'cover') {
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

const getSharedCssRulesServer = (
    marginTop: number,
    marginRight: number,
    marginBottom: number,
    marginLeft: number,
    pageSize: { width: string; height: string },
    currentChapterIndex: number,
    spacing: { paragraph: number; diagram: number; variation: number }
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
      --paragraph-spacing: ${spacing.paragraph}mm;
      --diagram-spacing: ${spacing.diagram}mm;
      --variation-spacing: ${spacing.variation}mm;
    }
  `

    return `${customVariables}\n${pdfPrintStyles}`
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

// Inserisci Diagramma: la posizione è sempre treeStore.activeFen; dove va nel documento dipende dalla modalità
watch(() => store.insertSignal, () => {
    const ed = editor.value
    if (!ed || store.activeSectionInfo?.type !== 'chapter') return

    try {
        const diagramFen = treeStore.activeFen
        const tree = treeStore.currentTree
        const block = tree ? findTreeBlock(tree.id) : null

        // Modalità libera: al cursore, senza toccare alberi
        if (!tree || !block) {
            ed.chain().focus().insertChessDiagram({ fen: diagramFen }).insertContent({ type: 'paragraph' }).run()
            return
        }

        const diagram = { type: 'chessDiagram', attrs: { fen: diagramFen } }
        const paragraph = { type: 'paragraph' }
        const afterBlock = block.pos + block.size
        const node = treeStore.currentNode

        // Posizione iniziale di un albero con mosse: il diagramma precede il blocco
        if (tree.rootNodes.length > 0 && !node) {
            ed.chain().focus().insertContentAt(block.pos, [diagram]).run()
            return
        }

        // Mossa in linea principale con mosse successive: si spezza l'albero in due
        if (node && node.children.length > 0 && treeStore.isNodeInMainline(tree.rootNodes, node.id)) {
            const newTreeId = treeStore.splitTree(tree.id, node.id)
            if (newTreeId) {
                ed.chain().focus().insertContentAt(afterBlock, [
                    diagram,
                    { type: 'chessTreeBlock', attrs: { treeId: newTreeId } },
                    paragraph
                ]).run()
                return
            }
        }

        // Albero vuoto, ultima mossa o mossa in una variante: dopo il blocco, albero intatto
        ed.chain().focus().insertContentAt(afterBlock, [diagram, paragraph]).run()
    } catch (error) {
        console.error('Errore durante l\'inserimento del diagramma:', error)
    }
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

    return getSharedCssRulesServer(marginTop, marginRight, marginBottom, marginLeft, pageSize, currentChapterIndex, bookSpacing.value)
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

        // Con la copertina attiva si esporta la copertina
    if (store.activeSectionInfo?.type === 'cover') {
        try {
            store.syncActiveSectionToCache()
            await pdfStore.exportCurrentChapter({
                htmlContent: await store.buildCoverHtml(store.activeSectionId!),
                customCss: getComputedCssRules(1),
                title: store.activeSectionInfo.title || 'copertina',
                chapterNumber: 1,
                pageSize: store.metadata.pageFormat || 'a4'
            })
        } catch (err) {
            alert("Si è verificato un errore durante l'esportazione della copertina.")
        }
        return
    }


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
            } else if (section.type === 'cover') {
                sectionHtml = await store.buildCoverHtml(section.id)
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

/** treeId dei blocchi albero presenti in un documento ProseMirror */
const treeIdsInDoc = (doc: PMNode): string[] => {
    const ids: string[] = []
    doc.descendants((node) => {
        if (node.type.name === 'chessTreeBlock' && node.attrs.treeId) ids.push(node.attrs.treeId)
    })
    return ids
}

const findTreeBlock = (treeId: string): { pos: number; size: number } | null => {
    const ed = editor.value
    if (!ed) return null
    let found: { pos: number; size: number } | null = null
    ed.state.doc.descendants((node, pos) => {
        if (found) return false
        if (node.type.name === 'chessTreeBlock' && node.attrs.treeId === treeId) {
            found = { pos, size: node.nodeSize }
            return false
        }
    })
    return found
}

// Posizione (tra due blocchi di primo livello) in cui verrebbe inserito il nuovo blocco
const resolveInsertPos = (placement: PgnPlacement): number | null => {
    const ed = editor.value
    if (!ed) return null
    const { doc, selection } = ed.state

    if (placement === 'end') return doc.content.size
    if (placement === 'cursor') {
        const $to = selection.$to
        return $to.depth >= 1 ? $to.after(1) : selection.to   // mai dentro un paragrafo
    }
    const id = treeStore.activeTreeId
    const block = id ? findTreeBlock(id) : null
    return block ? block.pos + block.size : null
}

const describePlacement = (placement: PgnPlacement): string => {
    const ed = editor.value
    if (!ed) return ''
    if (placement === 'end') return 'in fondo al capitolo'
    if (placement === 'after-active') {
        const tree = treeStore.currentTree
        return tree ? `subito dopo il blocco «${tree.title}»` : ''
    }
    const pos = resolveInsertPos('cursor')
    if (pos === null) return 'alla posizione del cursore'
    const before = ed.state.doc.resolve(pos).nodeBefore
    if (!before) return 'all’inizio del capitolo'
    const text = before.textContent.trim()
    if (!text) return 'dopo l’elemento precedente (diagramma o partita)'
    return `dopo il paragrafo «${text.length > 50 ? text.slice(0, 50) + '…' : text}»`
}

pgnStore.registerPlacementApi({ resolve: resolveInsertPos, describe: describePlacement })

// Riquadro tratteggiato nel punto di inserimento (solo con pannello aperto e "nuovo blocco")
const syncPgnMarker = () => {
    const ed = editor.value
    if (!ed) return
    const pos = pgnStore.isOpen && pgnStore.mode === 'new-tree'
        ? resolveInsertPos(pgnStore.placement)
        : null
    ed.commands.setPgnInsertMarker(pos)
}
watch(
    () => [pgnStore.isOpen, pgnStore.mode, pgnStore.placement, treeStore.activeTreeId],
    syncPgnMarker
)
watch(() => store.activeSectionId, () => nextTick(syncPgnMarker))

// Il marcatore segue il cursore quando si sceglie "dopo il cursore"
watch(editor, (ed) => {
    if (!ed) return
    ed.on('selectionUpdate', () => {
        if (!pgnStore.isOpen) return
        pgnStore.touchSelection()
        syncPgnMarker()
    })
}, { immediate: true })

const revealTreeBlock = (treeId: string) => {
    const ed = editor.value
    const block = findTreeBlock(treeId)
    if (!ed || !block) return
    const dom = ed.view.nodeDOM(block.pos) as HTMLElement | null
    if (!dom) return
    dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
    dom.classList.add('diagram-flash')
    setTimeout(() => dom.classList.remove('diagram-flash'), 1600)
}

// Richieste di inserimento: tutti i blocchi in una sola transazione (un solo Ctrl+Z annulla tutto)
watch(() => pgnStore.request, async (req) => {
    const ed = editor.value
    if (!req || !ed) return

    if (req.insert) {
        const size = ed.state.doc.content.size
        const pos = req.pos ?? size
        const atEnd = pos >= size
        ed.chain().insertContentAt(pos, [
            ...req.treeIds.map(id => ({ type: 'chessTreeBlock', attrs: { treeId: id } })),
            // in fondo al documento serve un paragrafo per poter continuare a scrivere
            ...(atEnd ? [{ type: 'paragraph' }] : [])
        ]).run()
    }

    await nextTick()
    revealTreeBlock(req.treeIds[0])
})

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
    margin-bottom: var(--paragraph-spacing, 4.5mm) !important;
    padding: 0 !important;
}

/* Prima di un diagramma o di una partita lo spazio è esattamente quello del blocco:
   il margine del paragrafo non si somma e non collassa con quello del blocco */
.tiptap p:has(+ .chess-diagram-container),
.tiptap p:has(+ .chess-tree-block-container) {
    margin-bottom: 0 !important;
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
    display: flow-root;   /* contiene i diagrammi a margine */
    width: 100%;
    max-width: 100%;
    word-break: break-word;
    overflow-wrap: break-word;
}

.tiptap h2,
.tiptap h3 {
    clear: both;          /* i titoli non si infilano accanto a un diagramma */
}

/* Sostituisce la regola della spaziatura aggiunta in precedenza */
.tiptap p:has(+ .chess-diagram-container:not([data-align="left"]):not([data-align="right"])),
.tiptap p:has(+ .chess-tree-block-container) {
    margin-bottom: 0 !important;
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

.pgn-insert-marker {
    margin: 8px 0;
    padding: 6px 10px;
    border: 2px dashed #3b82f6;
    border-radius: 6px;
    background: rgba(59, 130, 246, 0.06);
    color: #1d4ed8;
    font: 600 11px ui-sans-serif, system-ui, sans-serif;
    text-align: center;
    user-select: none;
}
</style>