<template>
    <div
        class="th-frame flex-1 bg-white border border-neutral-200 rounded-xl flex flex-col shadow-sm overflow-hidden relative">

        <PdfLoadingOverlay v-if="overlay" v-bind="overlay" @cancel="pdfStore.cancel()" />

        <EditorToolbar v-if="editor" v-show="!isCoverActive" :editor="editor" :zoom="zoomOption" @update:zoom="setZoom"
            @insert-tree-block="insertNewChessTreeBlock" @split-tree-block="handleSplitTreeBlock"
            @paste-tree-block="pasteTreeFromClipboard"
            @merge-tree-block="handleMergeTreeBlock" />

        <!-- Copertina: una pagina fissa, non un documento di testo -->
        <CoverEditor v-if="isCoverActive && store.coverModel" v-model="coverProxy" class="flex-1 min-h-0"
            :read-only="store.isLocked" :image-url="store.coverImageUrl" :page-width-mm="coverPageMm.width"
            :page-height-mm="coverPageMm.height" @pick-image="onPickCoverImage"
            @remove-image="store.removeCoverImage()" />

        <!-- Area di scrittura (scroll container) -->
        <div v-show="!isCoverActive" id="book-editor-content" ref="scrollContainer" class="flex-1 overflow-y-auto p-8"
            @click="handleCanvasClick">
            <!-- Contenitore flessibile privo di justify-center per evitare il bug del taglio a sinistra -->
            <div class="editor-scroll-wrapper" :style="{ minWidth: canvasMinWidth }">
                <!-- Wrapper di trasformazione zoom -->
                <div class="zoom-transform-wrapper transition-transform duration-150 ease-out origin-top-left ml-0"
                    :style="wrapperStyle">
                    <div @click.self="handlePageClick" class="tiptap-container" :class="pageClasses" :style="cssVars"
                        :spellcheck="spellcheck.settings.enabled ? 'true' : 'false'">
                        <!-- Spazio per la rilegatura: solo un promemoria nell'editor, nel PDF resta bianco -->
                        <div v-if="layout.gutterMm.value" class="binding-band" v-tooltip.desc="bindingTooltip"
                            @click="handlePageClick"></div>
                        <editor-content :editor="editor" />
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3'
import { computed, ref } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { usePdfStore } from '../stores/pdfStore'
import { useSpellcheckStore } from '../stores/spellcheckStore'
import { getPageSizeMm, type BookCover } from '../utils/cover'
import { useBookEditor } from '../composables/useBookEditor'
import { useEditorZoom } from '../composables/useEditorZoom'
import { usePageLayout } from '../composables/usePageLayout'
import { usePdfExport } from '../composables/usePdfExport'
import { useTreePlacement } from '../composables/useTreePlacement'
import { useBlockInsertion, pasteTreeFromClipboard } from '../composables/useBlockInsertion'
import EditorToolbar from './EditorToolbar.vue'
import CoverEditor from './cover/CoverEditor.vue'
import PdfLoadingOverlay from './PdfLoadingOverlay.vue'
import { platform } from '../platform'
import { vTooltip } from '../directives/tooltip'
import { isGeneratedSection } from '../utils/sectionOrder'
import '../assets/styles/book-typography.css'

const store = useChessBookStore()
const pdfStore = usePdfStore()

// --- Editor e sue funzioni ---
const { editor } = useBookEditor()
const spellcheck = useSpellcheckStore()   // l'attributo vale per testo, didascalie e commenti alle mosse
const layout = usePageLayout()
const { cssVars } = layout
const { insertNewChessTreeBlock, handleSplitTreeBlock, handleMergeTreeBlock } = useBlockInsertion(editor)
useTreePlacement(editor)

// --- Zoom ---
const scrollContainer = ref<HTMLElement | null>(null)
const { zoomOption, wrapperStyle, canvasMinWidth, setZoom } = useEditorZoom(scrollContainer)

// --- Esportazione PDF ---
const { isAssembling, assemblyLabel } = usePdfExport(editor, layout)
const overlay = computed(() => {
    if (pdfStore.isGeneratingPdf) {
        return {
            title: platform.capabilities.localPdf ? 'Generazione del PDF in corso...' : 'Generazione del PDF sul server in corso...',
            subtitle: pdfStore.progress ?? 'Elaborazione dei font e della paginazione.',
            cancellable: pdfStore.canCancel,
        }
    }
    if (isAssembling.value) {
        return { title: 'Generazione del libro in corso...', subtitle: assemblyLabel.value || 'Stiamo assemblando i capitoli e i diagrammi.' }
    }
    return null
})

// --- Copertina ---
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

// --- Foglio ---
const pageClasses = computed(() => ({
    'show-numbering': store.metadata.showNumbering,
    'is-two-columns': layout.twoColumns.value,
    // Solo i capitoli numerano i titoli
    'is-structural-page': store.activeSectionInfo?.type !== 'chapter',
    'is-generated-page': store.activeSectionInfo?.type === 'index' || isGeneratedSection(store.activeSectionInfo?.type)
}))

const bindingTooltip = computed(() => layout.binding.value === 'duplex'
    ? `Spazio per la rilegatura: ${layout.gutterMm.value} mm. Nel PDF sta a destra nelle pagine pari.`
    : `Spazio per la rilegatura: ${layout.gutterMm.value} mm.`)

// Clic nello spazio vuoto della pagina (sotto l'ultimo paragrafo): cursore in fondo al documento
const handlePageClick = () => {
    editor.value?.chain().focus('end').run()
}

// Clic nello spazio grigio esterno al foglio
const handleCanvasClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.id === 'book-editor-content' || target.classList.contains('editor-scroll-wrapper')) {
        editor.value?.chain().focus('end').run()
    }
}
</script>

<style>
/* Layout stile Google Docs / Word */
#book-editor-content {
    background-color: #f3f4f6;
    display: block;
    width: 100%;
    box-sizing: border-box;
}

/* Ancorato a sinistra: centrato, un foglio più largo dello spazio verrebbe tagliato a sinistra */
.editor-scroll-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: min-content;
    /* Permette all'elemento di espandere il contenitore nativo di scorrimento */
    width: 100%;
}

.zoom-transform-wrapper {
    margin-left: 0 !important;
    margin-right: auto !important;
    box-sizing: border-box;
    will-change: transform;
}

/* Tipografia di base (font, paragrafi, titoli, spaziatura prima dei blocchi): assets/styles/book-typography.css,
   condiviso con il PDF. Qui restano solo le regole valide per il solo editor. */

/* Colore dei sottotitoli: nell'editor segue il tema (ripiego #262626); nel PDF eredita il colore del testo */
.book-text-engine h3,
.tiptap h3,
.book-text-engine h4,
.tiptap h4 {
    color: var(--t-sheet-text, #262626) !important;
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

/* Titolo 3: la numerazione riparte a ogni Titolo 2 */
.show-numbering .tiptap h3 {
    counter-set: subsection-count 0;
}

.show-numbering .tiptap h4[data-toc-level="3"] {
    counter-increment: subsection-count;
}

.show-numbering .tiptap h4::before {
    content: counter(chapter-count) "." counter(section-count) "." counter(subsection-count) " ";
}

.is-structural-page .tiptap h2::before,
.is-structural-page .tiptap h3::before,
.is-structural-page .tiptap h4::before {
    content: none !important;
}

/* Struttura del Contenitore della Pagina Editor */
.tiptap-container {
    counter-reset: chapter-count var(--chapter-index) section-count 0 subsection-count 0;
    background: var(--t-sheet-bg, #ffffff);
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
    position: relative;
}

/* Indice e sezioni generate: l'editor perde gli stili in linea delle voci, quindi qui niente pallini degli elenchi del testo */
.is-generated-page .tiptap ul {
    list-style: none !important;
    padding-left: 0 !important;
}

/* Fascia della rilegatura: tenue, sul bordo sinistro, larga quanto lo spazio aggiunto al margine */
.binding-band {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--binding-width);
    background: repeating-linear-gradient(135deg, rgba(120, 110, 90, 0.07) 0 4px, transparent 4px 8px);
    border-right: 1px dashed rgba(120, 110, 90, 0.28);
}

.tiptap:focus {
    outline: none;
}

.tiptap {
    display: flow-root;
    /* contiene i diagrammi a margine */
    width: 100%;
    max-width: 100%;
    word-break: break-word;
    overflow-wrap: break-word;
}

/* Nessun rientro della prima riga nei paragrafi */
.tiptap p,
.ProseMirror p {
    text-indent: 0em;
}

/* Stesso azzeramento per i paragrafi dentro i blocchi albero */
.tiptap [data-type="chess-tree-block"] p,
.ProseMirror [data-type="chess-tree-block"] p {
    text-indent: 0;
}

/* Personalizzazione Caret (Cursore di Scrittura) */
.ProseMirror {
    caret-color: var(--t-accent-text, #2563eb) !important;
    /* Segue il colore di accento del tema */
}

/* Nessun contorno del browser attorno all'editor a fuoco */
.ProseMirror-focused {
    outline: none !important;
}

/* Indicatore discreto di blocco/paragrafo attivo (Stile Google Docs / Notion) */
.ProseMirror p.is-node-focused,
.ProseMirror h2.is-node-focused,
.ProseMirror h3.is-node-focused,
.ProseMirror h4.is-node-focused {
    position: relative;
    background-color: var(--t-accent-wash, rgba(239, 246, 255, 0.4));
    border-radius: 2px;
}

/* Linea di focus laterale sul paragrafo/blocco in cui si trova il cursore */
.ProseMirror p.is-node-focused::before,
.ProseMirror h2.is-node-focused::before,
.ProseMirror h3.is-node-focused::before,
.ProseMirror h4.is-node-focused::before {
    content: '';
    position: absolute;
    left: -12px;
    top: 0;
    bottom: 0;
    width: 3px;
    background-color: var(--t-accent, #3b82f6);
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
    border: 2px dashed var(--t-accent, #3b82f6);
    border-radius: 6px;
    background: var(--t-accent-tint, rgba(59, 130, 246, 0.06));
    color: var(--t-accent-text, #1d4ed8);
    font: 600 11px ui-sans-serif, system-ui, sans-serif;
    text-align: center;
    user-select: none;
}

.tiptap .diagram-ref.is-broken {
    background-color: #b91c1c !important;
}
</style>