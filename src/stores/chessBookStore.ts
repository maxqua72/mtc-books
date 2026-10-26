import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import { db, putAsset, getAsset, saveFullStateToIndexedDB } from '../db'
import { createEmptyCover, normalizeCover } from '../utils/cover'
import { extractTreeIds } from '../utils/html'
import { randomToken } from '../utils/ids'
import { sanitizeTrees, sanitizeSectionIndex } from '../utils/sanitize'
import type { BoardShape } from '../utils/shapes'
import { useChessTreeStore, type ChessTree } from './chessTreeStore'
import { defaultMetadata, type BookMetadata, type SaveStatus, type SectionIndexItem, type SectionType } from './book/types'
import { useCover } from './book/useCover'
import { useFileState } from './book/useFileState'
import { useDiagramIndex } from './book/useDiagramIndex'
import { useGeneratedToc } from './book/useGeneratedToc'
import { parseMtcBook, buildMtcBook, type BookAsset } from './book/mtcbookIO'

// I tipi restano importabili da qui, come prima della divisione in moduli
export type { SectionType, PageFormat, SaveStatus, SectionIndexItem, BookMetadata } from './book/types'

/**
 * Store del libro: stato di base, navigazione tra le sezioni e persistenza.
 * La logica specializzata sta in ./book/: copertina, numerazione diagrammi, indice,
 * stato della copia su disco, I/O del pacchetto .mtcbook.
 * Le chiavi restituite sono le stesse di sempre: i componenti non cambiano.
 */
export const useChessBookStore = defineStore('chessBook', () => {
    // Sezioni già passate da sanitizeTrees: al ritorno non si ripete la ricostruzione
    const sanitizedSections = new Set<string>()

    // --- Scacchiera e segnali verso l'editor ---
    const activeFen = ref('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    const globalDiagramSize = ref(28)
    const insertSignal = ref(0)
    const activeShapes = ref<BoardShape[]>([])   // frecce da copiare nel prossimo diagramma inserito
    const exportServerChapterSignal = ref(0)
    const exportServerFullBookSignal = ref(0)

    const isBookLoaded = ref(false)
    const saveStatus = ref<SaveStatus>('saved')

    // --- Struttura del libro ---
    const metadata = ref<BookMetadata>(defaultMetadata())
    const sectionIndex = ref<SectionIndexItem[]>([])
    const activeSectionId = ref<string | null>(null)
    // HTML della sola sezione aperta nell'editor
    const activeSectionHtml = ref<string>('')
    // "Disco virtuale": JSON grezzo di ogni sezione, analizzato solo all'apertura. Chiave: id sezione.
    const zippedSectionsCache = ref<Record<string, string>>({})

    // --- Moduli specializzati ---
    const cover = useCover({ sectionIndex, activeSectionId, zippedSectionsCache, metadata })
    const fileState = useFileState({ metadata, sectionIndex, zippedSectionsCache })
    const scanSources = { activeSectionId, activeSectionHtml, zippedSectionsCache }
    const { diagramLabels, diagramList, unresolvedDiagramRefs } = useDiagramIndex(sectionIndex, scanSources)
    const generatedTocHtml = useGeneratedToc(sectionIndex, scanSources, metadata)

    // --- Getter ---
    const activeSectionInfo = computed(() =>
        sectionIndex.value.find(s => s.id === activeSectionId.value) || null
    )

    const currentChapterNumber = computed(() => {
        if (!activeSectionId.value) return 1
        // Solo i capitoli reali: copertina e indice non contano
        const chapters = sectionIndex.value.filter(s => s.type === 'chapter')
        const currentIndex = chapters.findIndex(s => s.id === activeSectionId.value)
        return currentIndex !== -1 ? currentIndex + 1 : 1
    })

    // --- Azioni semplici (segnali) ---
    const updateActiveFen = (fen: string) => { activeFen.value = fen }
    const updateActiveShapes = (shapes: BoardShape[]) => { activeShapes.value = shapes }
    const triggerInsertDiagram = () => { insertSignal.value++ }
    const triggerServerChapterPdfExport = () => { exportServerChapterSignal.value++ }
    const triggerServerFullBookPdfExport = () => { exportServerFullBookSignal.value++ }

    // --- Cache della sezione attiva ---
    function syncActiveSectionToCache(opts: { html?: string; prune?: boolean } = {}) {
        const id = activeSectionId.value
        if (!id) return

        // L'indice è contenuto generato: non entra mai nella cache
        if (activeSectionInfo.value?.type === 'index') return

        // La copertina non ha HTML né partite: si salva il suo modello
        if (activeSectionInfo.value?.type === 'cover') {
            if (cover.coverModel.value) {
                zippedSectionsCache.value[id] = JSON.stringify({
                    id, html: '', trees: [], cover: cover.coverModel.value
                })
            }
            return
        }

        const treeStore = useChessTreeStore()
        const html = opts.html ?? activeSectionHtml.value

        let trees = treeStore.trees
        if (opts.prune) {
            // copia filtrata, NON modifica lo store
            const used = new Set(extractTreeIds(html))
            trees = trees.filter(t => used.has(t.id))
        }
        zippedSectionsCache.value[id] = JSON.stringify({ id, html, trees })
    }

    /**
     * Cambia la sezione attiva gestendo la memoria (apertura lazy).
     * @param nextSectionId sezione da caricare
     * @param currentEditorContent HTML aggiornato dell'editor, per congelare la sezione in uscita
     */
    async function changeActiveSection(nextSectionId: string, currentEditorContent?: string) {
        const chessTreeStore = useChessTreeStore()

        if (activeSectionId.value && currentEditorContent !== undefined) {
            syncActiveSectionToCache({ html: currentEditorContent, prune: true })
        }

        const nextType = sectionIndex.value.find(s => s.id === nextSectionId)?.type
        const cachedData = zippedSectionsCache.value[nextSectionId]
        let nextHtml = ''
        let nextTrees: ChessTree[] = []
        let nextCover: unknown = null

        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData)
                nextHtml = parsed.html || ''
                nextTrees = sanitizedSections.has(nextSectionId)
                    ? (Array.isArray(parsed.trees) ? parsed.trees : [])
                    : sanitizeTrees(parsed.trees)
                sanitizedSections.add(nextSectionId)
                nextCover = parsed.cover ?? null
            } catch (e) {
                console.error('Errore nel parsing della sezione:', e)
            }
        }

        // Prima partite e copertina negli store, poi la sezione attiva (che fa ripartire l'editor)
        chessTreeStore.setChapterTrees(nextType === 'cover' ? [] : nextTrees)
        cover.coverModel.value = nextType === 'cover' ? normalizeCover(nextCover) : null

        activeSectionId.value = nextSectionId
        activeSectionHtml.value = nextHtml

        if (nextType === 'cover') void cover.refreshCoverImageUrl()
        else cover.clearCoverImageUrl()
    }

    /** Crea una nuova sezione (es. un nuovo capitolo) */
    function createNewSection(title: string, type: SectionType = 'chapter') {
        const id = `sec-${randomToken()}`
        sectionIndex.value.push({ id, type, title })
        zippedSectionsCache.value[id] = JSON.stringify(
            type === 'cover'
                ? { id, html: '', trees: [], cover: createEmptyCover() }
                : { id, html: '' }
        )
        return id
    }

    // --- Persistenza locale (IndexedDB) ---

    /** Salva tutto in IndexedDB. Con refreshDirty ricalcola anche lo stato della copia su disco. */
    async function persistToIndexedDB(opts: { refreshDirty?: boolean } = {}) {
        syncActiveSectionToCache()   // niente prune: l'autosave non cancella mai alberi
        if (opts.refreshDirty) fileState.refreshFileDirty()
        await saveFullStateToIndexedDB(
            metadata.value,
            sectionIndex.value,
            activeSectionId.value,
            zippedSectionsCache.value,
            cover.collectAssetIds(),
            fileState.fileDirty.value
        )
    }

    /** Ripristina la sessione da IndexedDB al ricaricamento della pagina */
    async function restoreFromIndexedDB(): Promise<boolean> {
        try {
            const savedState = await db.bookState.get('current_book')
            if (!savedState) return false
            fileState.setLocked(true)   // dopo un ricaricamento si riparte in sola lettura

            metadata.value = { ...defaultMetadata(), ...savedState.metadata }
            sectionIndex.value = sanitizeSectionIndex(savedState.sectionIndex)

            // Si mantiene la stringa JSON integra ({ id, html, trees })
            zippedSectionsCache.value = {}
            for (const sec of await db.sections.toArray()) zippedSectionsCache.value[sec.id] = sec.json
            sanitizedSections.clear()

            // Stato della copia su disco: se non era noto (dati vecchi) lo si considera non aggiornato
            fileState.resetFileBaseline(savedState.dirtyVsFile ?? true)

            const sectionToOpen = savedState.activeSectionId || sectionIndex.value[0]?.id
            if (sectionToOpen) await changeActiveSection(sectionToOpen)

            isBookLoaded.value = true
            return true
        } catch (error) {
            console.error('Errore nel ripristino da IndexedDB:', error)
            return false
        }
    }

    // --- Nuovo libro e file .mtcbook ---

    async function startNewBook(title: string, author: string) {
        fileState.setLocked(false)   // un libro nuovo è subito modificabile
        // Azzera tutto PRIMA: con activeSectionId null changeActiveSection non congela nulla
        activeSectionId.value = null
        activeSectionHtml.value = ''
        zippedSectionsCache.value = {}
        sectionIndex.value = []
        useChessTreeStore().setChapterTrees([])

        metadata.value = { ...defaultMetadata(), title, author }

        const firstId = createNewSection('Capitolo 1', 'chapter')
        await changeActiveSection(firstId)
        isBookLoaded.value = true
        fileState.resetFileBaseline(true)   // mai salvato su file
        await persistToIndexedDB()
    }

    /** Apre un file .mtcbook: legge subito metadati e indice, i capitoli restano congelati nella cache */
    async function loadMtcBook(fileBuffer: ArrayBuffer | Blob) {
        const pkg = await parseMtcBook(fileBuffer)   // se il file non è valido si lancia qui, prima di toccare lo stato

        fileState.setLocked(true)   // un libro aperto da file è in sola lettura finché non si sblocca
        useChessTreeStore().setChapterTrees([])

        metadata.value = pkg.metadata
        sectionIndex.value = pkg.sectionIndex
        zippedSectionsCache.value = pkg.sections
        sanitizedSections.clear()

        for (const a of pkg.assets) await putAsset({ id: a.id, blob: a.blob, type: a.type, name: a.id })

        if (sectionIndex.value.length > 0) {
            await changeActiveSection(sectionIndex.value[0].id)
            await nextTick()
        }
        isBookLoaded.value = true

        // La copia di lavoro in IndexedDB diventa questo libro (altrimenti F5 riaprirebbe quello precedente)
        syncActiveSectionToCache()
        fileState.resetFileBaseline(false)
        await persistToIndexedDB()
    }

    /** Esporta lo stato attuale come blob .mtcbook. `currentEditorContent` = HTML dell'editor attivo. */
    async function exportMtcBook(currentEditorContent: string): Promise<Blob> {
        syncActiveSectionToCache({ html: currentEditorContent, prune: true })
        metadata.value.updatedAt = new Date().toISOString()

        const assets: BookAsset[] = []
        for (const id of cover.collectAssetIds()) {
            const asset = await getAsset(id)
            if (asset) assets.push({ id, blob: asset.blob, type: asset.type })
        }

        return buildMtcBook({
            metadata: metadata.value,
            sectionIndex: sectionIndex.value,
            sections: zippedSectionsCache.value,
            assets
        })
    }

    return {
        // Scacchiera e segnali
        activeFen, globalDiagramSize, insertSignal, activeShapes,
        updateActiveFen, updateActiveShapes, triggerInsertDiagram,
        exportServerChapterSignal, exportServerFullBookSignal,
        triggerServerChapterPdfExport, triggerServerFullBookPdfExport,

        // Struttura del libro
        isBookLoaded, metadata, sectionIndex, activeSectionId, activeSectionHtml, zippedSectionsCache,
        activeSectionInfo, currentChapterNumber, generatedTocHtml,
        diagramLabels, diagramList, unresolvedDiagramRefs,

        // Operazioni
        changeActiveSection, createNewSection, syncActiveSectionToCache,
        startNewBook, loadMtcBook, exportMtcBook,

        // Salvataggio e ripristino
        saveStatus, persistToIndexedDB, restoreFromIndexedDB,
        isLocked: fileState.isLocked, fileDirty: fileState.fileDirty,
        setLocked: fileState.setLocked, markFileSaved: fileState.markFileSaved,

        // Copertina
        coverModel: cover.coverModel, coverImageUrl: cover.coverImageUrl,
        setCoverImage: cover.setCoverImage, removeCoverImage: cover.removeCoverImage,
        buildCoverHtml: cover.buildCoverHtml, collectAssetIds: cover.collectAssetIds,
    }
})
