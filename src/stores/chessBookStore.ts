import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import JSZip from 'jszip'
import { db, putAsset, getAsset } from '../db'
import {
    type BookCover, createEmptyCover, normalizeCover, coverToHtml,
    blobToDataUrl, getPageSizeMm, newCoverId
} from '../utils/cover'
import { useChessTreeStore, type ChessTree } from './chessTreeStore'

// 1. DEFINIZIONE DELLE INTERFACCE
export type SectionType = 'cover' | 'index' | 'chapter'
export type PageFormat = 'a4' | 'crown-quarto' | 'b-format'
export type SaveStatus = 'saved' | 'saving' | 'unsaved'

export interface SectionIndexItem {
    id: string
    type: SectionType
    title: string
}

interface SectionData {
    id: string
    html: string
    trees: ChessTree[] // <--- I tree di QUESTA specifica sezione
}

export interface BookMetadata {
    version: string
    title: string
    author: string
    createdAt: string
    updatedAt: string
    pageFormat: PageFormat
    isTwoColumns: boolean,
    showNumbering: boolean,
    pageMarginTop: number
    pageMarginRight: number
    pageMarginBottom: number
    pageMarginLeft: number
    paragraphSpacing: number   // mm: tra due paragrafi
    diagramSpacing: number     // mm: sopra e sotto i diagrammi
    variationSpacing: number   // mm: sopra e sotto i blocchi di partita/varianti
}


export const useChessBookStore = defineStore('chessBook', () => {
    // --- STATO ESISTENTE (Scacchiera e Segnali) ---
    const activeFen = ref('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    const globalDiagramSize = ref(28)
    const insertSignal = ref(0)

    // --- NUOVI SEGNALI PER ESPORTAZIONE SERVER (PLAYWRIGHT) ---
    const exportServerChapterSignal = ref(0)  // Esportazione Capitolo (Server)
    const exportServerFullBookSignal = ref(0) // Esportazione Libro (Server)

    const isBookLoaded = ref(false)
    const saveStatus = ref<SaveStatus>('saved')

    // --- NUOVO STATO (Metadati e Struttura Libro) ---
    const defaultMetadata = (): BookMetadata => ({
        version: '1.0.0',
        title: 'Nuovo Libro di Scacchi',
        author: 'Autore',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pageFormat: 'a4',
        isTwoColumns: false,
        showNumbering: true,
        pageMarginTop: 25,
        pageMarginRight: 20,
        pageMarginBottom: 25,
        pageMarginLeft: 20,
        paragraphSpacing: 4.5,
        diagramSpacing: 5,
        variationSpacing: 4
    })

    const metadata = ref<BookMetadata>(defaultMetadata())

    // L'indice delle sezioni (caricato subito in Fase A)
    const sectionIndex = ref<SectionIndexItem[]>([])

    // L'ID della sezione attualmente aperta nell'editor
    const activeSectionId = ref<string | null>(null)

    // Il contenuto HTML della sola sezione attiva nell'editor (Fase B)
    const activeSectionHtml = ref<string>('')

    // Il "disco virtuale": tiene in memoria i file compressi non ancora aperti
    // Chiave: sectionId, Valore: la stringa JSON grezza o l'oggetto compresso da estrarre su richiesta
    const zippedSectionsCache = ref<Record<string, string>>({})

    // --- COPERTINA ---
    // Modello della copertina quando la sezione attiva è di tipo 'cover' (altrimenti null)
    const coverModel = ref<BookCover | null>(null)
    // URL temporaneo dell'immagine di sfondo, per l'anteprima nell'editor
    const coverImageUrl = ref<string | null>(null)
    let coverObjectUrl: string | null = null

    const EXT_BY_MIME: Record<string, string> = {
        'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'
    }
    const MIME_BY_EXT: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp'
    }
    const MAX_COVER_IMAGE_BYTES = 25 * 1024 * 1024

    const clearCoverImageUrl = () => {
        if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl)
        coverObjectUrl = null
        coverImageUrl.value = null
    }

    async function refreshCoverImageUrl() {
        const id = coverModel.value?.image?.assetId
        if (!id) { clearCoverImageUrl(); return }

        const asset = await getAsset(id)
        // Nel frattempo l'immagine (o la sezione) può essere cambiata
        if (coverModel.value?.image?.assetId !== id) return
        if (!asset) { clearCoverImageUrl(); return }

        clearCoverImageUrl()
        coverObjectUrl = URL.createObjectURL(asset.blob)
        coverImageUrl.value = coverObjectUrl
    }

    /** Salva l'immagine scelta come asset e la collega alla copertina attiva */
    async function setCoverImage(file: File) {
        if (!coverModel.value) return
        if (!(file.type in EXT_BY_MIME)) throw new Error('Formato non supportato: usa PNG, JPEG o WebP.')
        if (file.size > MAX_COVER_IMAGE_BYTES) throw new Error('Immagine troppo grande (massimo 25 MB).')
        try {
            (await createImageBitmap(file)).close() // verifica che sia un'immagine leggibile
        } catch {
            throw new Error("Impossibile leggere l'immagine.")
        }

        const id = newCoverId('img')
        await putAsset({ id, blob: file, type: file.type, name: file.name })
        coverModel.value = { ...coverModel.value, image: { assetId: id, x: 50, y: 50, zoom: 1 } }
        await refreshCoverImageUrl()
    }

    async function removeCoverImage() {
        if (!coverModel.value) return
        coverModel.value = { ...coverModel.value, image: null }
        clearCoverImageUrl()
        // il file in IndexedDB viene eliminato al prossimo salvataggio
    }

    /** Identificativi delle immagini usate dalle copertine del libro */
    function collectAssetIds(): string[] {
        const ids = new Set<string>()
        for (const item of sectionIndex.value) {
            if (item.type !== 'cover') continue
            let cover: BookCover | null = null
            if (item.id === activeSectionId.value) {
                cover = coverModel.value
            } else {
                try {
                    cover = normalizeCover(JSON.parse(zippedSectionsCache.value[item.id] || '{}').cover)
                } catch { cover = null }
            }
            if (cover?.image) ids.add(cover.image.assetId)
        }
        return [...ids]
    }

    /** HTML della copertina pronto per il PDF (con l'immagine incorporata) */
    async function buildCoverHtml(sectionId: string): Promise<string> {
        let cover: BookCover
        if (sectionId === activeSectionId.value && coverModel.value) {
            cover = coverModel.value
        } else {
            try {
                cover = normalizeCover(JSON.parse(zippedSectionsCache.value[sectionId] || '{}').cover)
            } catch { cover = createEmptyCover() }
        }

        let src: string | null = null
        if (cover.image) {
            const asset = await getAsset(cover.image.assetId)
            if (asset) src = await blobToDataUrl(asset.blob)
        }
        return coverToHtml(cover, src, getPageSizeMm(metadata.value.pageFormat))
    }

    // --- GETTERS COMPOSITI ---
    const activeSectionInfo = computed(() => {
        return sectionIndex.value.find(s => s.id === activeSectionId.value) || null
    })

    const currentChapterNumber = computed(() => {
        if (!activeSectionId.value) return 1

        // Filtra solo i capitoli reali ignorando indici/sezioni speciali
        const chapters = sectionIndex.value.filter(s => s.type === 'chapter')
        const currentIndex = chapters.findIndex(s => s.id === activeSectionId.value)

        return currentIndex !== -1 ? currentIndex + 1 : 1
    })

    /**
    * Genera dinamicamente la struttura HTML dell'indice basandosi sui capitoli presenti
    */
    const generatedTocHtml = computed(() => {
        const chapters = sectionIndex.value.filter(s => s.type === 'chapter')

        if (chapters.length === 0) {
            return `
  <div class="toc-container">
    <h2>Indice Generale</h2>
    <p style="color: #a3a3a3; font-style: italic;">Nessun capitolo inserito nel libro.</p>
  </div>
`
        }

        const parser = new DOMParser()
        let htmlResult = `<div class="toc-container"><h2 style="font-family: Lora, Georgia, serif; font-size: 2rem; margin-bottom: 1.5rem;">Indice Generale</h2><ul style="list-style: none; padding: 0; margin: 0; font-family: Lora,Georgia, serif;">`

        let mainCounter = 0

        for (const ch of chapters) {
            mainCounter++ // Incrementa a ogni capitolo per rispecchiare l'ordine della barra laterale
            let subCounter = 0 // Resetta i sotto-capitoli per questo specifico capitolo

            // Recupera l'HTML corrente dello store (se attivo nell'editor) o della cache compressa
            let chHtml = ''
            if (ch.id === activeSectionId.value) {
                chHtml = activeSectionHtml.value
            } else {
                const cached = zippedSectionsCache.value[ch.id]
                chHtml = cached ? JSON.parse(cached).html : ''
            }

            const doc = parser.parseFromString(chHtml, 'text/html')
            // Peschiamo solo i nodi esplicitamente marcati dall'attributo inserito dalla toolbar
            const trackedHeaders = doc.querySelectorAll('[data-toc-level]')

            trackedHeaders.forEach((el) => {
                const level = el.getAttribute('data-toc-level')
                const text = el.textContent?.trim() || 'Titolo senza testo'
                let numbering = ''
                let paddingLeft = '0px'
                let fontSize = '1rem'
                let fontWeight = 'bold'

                if (level === '1') {
                    numbering = `${mainCounter}. `
                    paddingLeft = '0px'
                    fontSize = '1.1rem'
                } else if (level === '2') {
                    subCounter++
                    numbering = `${mainCounter}.${subCounter} `
                    paddingLeft = '20px'
                    fontSize = '0.95rem'
                    fontWeight = 'normal'
                }

                htmlResult += `
    <li style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-left: ${paddingLeft}; font-size: ${fontSize}; font-weight: ${fontWeight}; border-bottom: 1px dotted #e5e7eb;">
      <span style="background: #fff; padding-right: 4px;">${numbering}${text}</span>
      <span style="background: #fff; padding-left: 4px; color: #737373;">...</span>
    </li>
  `
            })
        }

        htmlResult += `</ul></div>`
        return htmlResult
    })


    // ==========================================================
    // RIFERIMENTI AI DIAGRAMMI
    // ==========================================================
    interface DiagramLabel { label: string; caption: string; sectionId: string }
    interface SectionScan {
        diagrams: { id: string | null; caption: string }[]
        refTargets: string[]
    }

    // Fuori dalla reattività: un capitolo si rianalizza solo se la sua sorgente è cambiata
    const sectionScanCache = new Map<string, { source: string; scan: SectionScan }>()

    const scanSection = (sectionId: string, source: string, isJson: boolean): SectionScan => {
        const cached = sectionScanCache.get(sectionId)
        if (cached && cached.source === source) return cached.scan

        let html = source
        if (isJson) {
            try { html = source ? JSON.parse(source).html || '' : '' } catch { html = '' }
        }

        const doc = new DOMParser().parseFromString(html, 'text/html')
        const scan: SectionScan = {
            diagrams: Array.from(doc.querySelectorAll('[data-type="chess-diagram"]')).map(el => ({
                id: el.getAttribute('data-id'),
                caption: el.querySelector('.diagram-caption')?.textContent?.trim() ?? ''
            })),
            refTargets: Array.from(doc.querySelectorAll('[data-type="diagram-ref"]'))
                .map(el => el.getAttribute('data-target-id') || '')
                .filter(Boolean)
        }
        sectionScanCache.set(sectionId, { source, scan })
        return scan
    }

    const diagramData = computed(() => {
        const labels = new Map<string, DiagramLabel>()
        const refTargets: string[] = []
        let chapterNumber = 0

        for (const section of sectionIndex.value) {
            if (section.type !== 'chapter') continue
            chapterNumber++ // stessa regola del PDF: contano solo i capitoli

            const scan = section.id === activeSectionId.value
                ? scanSection(section.id, activeSectionHtml.value, false)
                : scanSection(section.id, zippedSectionsCache.value[section.id] || '', true)

            // Il progressivo conta TUTTI i diagrammi (anche quelli senza ID): coincide col contatore CSS del PDF
            scan.diagrams.forEach((d, i) => {
                if (d.id) {
                    labels.set(d.id, {
                        label: `${chapterNumber}.${i + 1}`,
                        caption: d.caption,
                        sectionId: section.id
                    })
                }
            })
            refTargets.push(...scan.refTargets)
        }
        return { labels, refTargets }
    })

    const diagramLabels = computed(() => diagramData.value.labels)
    const diagramList = computed(() =>
        Array.from(diagramLabels.value, ([id, v]) => ({ id, ...v }))
    )
    const unresolvedDiagramRefs = computed(() =>
        diagramData.value.refTargets.filter(id => !diagramLabels.value.has(id))
    )


    // --- FUNZIONI ESISTENTI ---
    function updateActiveFen(fen: string) {
        activeFen.value = fen
    }

    function triggerInsertDiagram() {
        insertSignal.value++
    }

    // --- NUOVE FUNZIONI TRIGGER PER ESPORTAZIONE SERVER ---
    function triggerServerChapterPdfExport() {
        exportServerChapterSignal.value++
    }

    function triggerServerFullBookPdfExport() {
        exportServerFullBookSignal.value++
    }

    // --- NUOVE FUNZIONI: NAVIGAZIONE (LAZY LOADING) ---

    /**
     * Cambia la sezione attiva nell'editor gestendo la memoria (Fase B)
     * @param nextSectionId ID della sezione da caricare
     * @param currentEditorContent L'HTML aggiornato dell'editor prima di chiuderlo
     */
    async function changeActiveSection(nextSectionId: string, currentEditorContent?: string) {
        const chessTreeStore = useChessTreeStore()
        // 1. Se c'era una sezione aperta, congeliamo il suo contenuto attuale nella cache di memoria
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
                nextTrees = parsed.trees || []
                nextCover = parsed.cover ?? null
            } catch (e) {
                console.error('Errore nel parsing della sezione:', e)
            }
        }

        // Carica subito partite e copertina negli store (PRIMA di cambiare sezione attiva)
        chessTreeStore.setChapterTrees(nextType === 'cover' ? [] : nextTrees)
        coverModel.value = nextType === 'cover' ? normalizeCover(nextCover) : null

        // DOPO: impostiamo l'ID e l'HTML per attivare il re-render dell'editor
        activeSectionId.value = nextSectionId
        activeSectionHtml.value = nextHtml

        if (nextType === 'cover') void refreshCoverImageUrl()
        else clearCoverImageUrl()
    }

    async function startNewBook(title: string, author: string) {
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
    }

    // --- NUOVE FUNZIONI: I/O FILE .MTCBOOK (JSZIP) ---

    /**
     * FASE A: Carica un file .mtcbook estratto dal computer dell'utente
     * Legge solo i metadati; i capitoli rimangono congelati nella cache interna.
     */
    async function loadMtcBook(fileBuffer: ArrayBuffer | Blob) {
        const chessTreeStore = useChessTreeStore()

        // Resetta completamente lo store delle partite del vecchio libro aperto
        //chessTreeStore.resetStore?.()

        const zip = await JSZip.loadAsync(fileBuffer)

        // 1. Svuotiamo lo store globale delle partite
        chessTreeStore.trees = []

        // 1. Estrazione del file di indice e metadati (leggero)
        const bookJsonRaw = await zip.file('book.json')?.async('string')
        if (!bookJsonRaw) throw new Error('File book.json non trovato nell\'archivio.')

        const bookData = JSON.parse(bookJsonRaw)

        // 2. Popoliamo lo stato dei metadati e dell'indice (la barra laterale si aggiorna subito)
        metadata.value = {
            version: bookData.version,
            title: bookData.title,
            author: bookData.author,
            createdAt: bookData.createdAt,
            updatedAt: bookData.updatedAt,
            pageFormat: bookData.pageFormat || 'a4',
            isTwoColumns: bookData.isTwoColumns || false,
            showNumbering: bookData.showNumbering !== undefined ? bookData.showNumbering : true,

            // Nuovi campi: se non esistono nel vecchio file JSON, applichiamo i default numerici
            pageMarginTop: bookData.pageMarginTop !== undefined ? Number(bookData.pageMarginTop) : 25,
            pageMarginRight: bookData.pageMarginRight !== undefined ? Number(bookData.pageMarginRight) : 20,
            pageMarginBottom: bookData.pageMarginBottom !== undefined ? Number(bookData.pageMarginBottom) : 25,
            pageMarginLeft: bookData.pageMarginLeft !== undefined ? Number(bookData.pageMarginLeft) : 20,
            paragraphSpacing: bookData.paragraphSpacing !== undefined ? Number(bookData.paragraphSpacing) : 4.5,
            diagramSpacing: bookData.diagramSpacing !== undefined ? Number(bookData.diagramSpacing) : 5,
            variationSpacing: bookData.variationSpacing !== undefined ? Number(bookData.variationSpacing) : 4
        }
        sectionIndex.value = bookData.sectionIndex

        // 3. Inizializziamo la cache congelata leggendo i puntatori ai file delle sezioni, 
        // ma SENZA parsarli in oggetti HTML/DOM complessi.
        zippedSectionsCache.value = {}
        const sectionsFolder = zip.folder('sections')

        if (sectionsFolder) {
            for (const item of sectionIndex.value) {
                const sectionFile = sectionsFolder.file(`${item.id}.json`)
                if (sectionFile) {
                    // Conserviamo la stringa json grezza non letta
                    zippedSectionsCache.value[item.id] = await sectionFile.async('string')
                }
            }
        }

                // 3b. Immagini della copertina: dallo zip a IndexedDB
        const assetsFolder = zip.folder('assets')
        if (assetsFolder) {
            const entries: { id: string; file: JSZip.JSZipObject; type: string }[] = []
            assetsFolder.forEach((relativePath, file) => {
                if (file.dir) return
                const m = /^([\w-]{1,64})\.(png|jpg|jpeg|webp)$/i.exec(relativePath)
                if (m) entries.push({ id: m[1], file, type: MIME_BY_EXT[m[2].toLowerCase()] })
            })
            for (const e of entries) {
                const data = await e.file.async('arraybuffer')
                await putAsset({ id: e.id, blob: new Blob([data], { type: e.type }), type: e.type, name: e.id })
            }
        }

        // 4. Apriamo automaticamente la prima sezione disponibile (se presente)
        if (sectionIndex.value.length > 0) {
            await changeActiveSection(sectionIndex.value[0].id)
            await nextTick()
        }
        isBookLoaded.value = true
    }

    /**
     * FASE C (Parziale): Esporta lo stato attuale in un blob binario ZIP .mtcbook
     * @param currentEditorContent Il contenuto testuale dell'editor attualmente attivo
     */
    async function exportMtcBook(currentEditorContent: string): Promise<Blob> {
        const zip = new JSZip()
        //const chessTreeStore = useChessTreeStore()

        // 1. Prima della pulizia, eseguiamo la Garbage Collection sui tree del solo capitolo attivo
        syncActiveSectionToCache({ html: currentEditorContent, prune: true })

        // --- GARBAGE COLLECTION PARTITE ZOMBI ---
        /*
        const allUsedTreeIds = new Set<string>()

        // Raccoglie tutti i tree-id presenti in TUTTE le sezioni del libro
        Object.values(zippedSectionsCache.value).forEach(jsonString => {
            try {
                const parsed = JSON.parse(jsonString)
                const ids = extractTreeIdsFromHtml(parsed.html)
                ids.forEach(id => allUsedTreeIds.add(id))
            } catch (e) {
                console.error("Errore nel parsing della sezione per la pulizia tree", e)
            }
        })

        // Elimina dallo store tutti gli alberi che non compaiono in nessuna sezione del libro
        chessTreeStore.cleanOrphanTrees(Array.from(allUsedTreeIds))
        */
        // ----------------------------------------

        // 2. Prepariamo il payload del file book.json
        metadata.value.updatedAt = new Date().toISOString()
        const bookJsonData = {
            ...metadata.value,
            sectionIndex: sectionIndex.value
        }
        zip.file('book.json', JSON.stringify(bookJsonData, null, 2))

        // 3. Iniettiamo tutte le sezioni dalla cache nella cartella virtuale
        /*const sectionsFolder = zip.folder('sections')
        if (sectionsFolder) {
            for (const [id, jsonString] of Object.entries(zippedSectionsCache.value)) {
                sectionsFolder.file(`${id}.json`, jsonString)
            }
        }*/

        // 3. Iniettiamo nella cartella virtuale solo le sezioni presenti nell'indice
        const sectionsFolder = zip.folder('sections')
        if (sectionsFolder) {
            for (const item of sectionIndex.value) {
                const json = zippedSectionsCache.value[item.id]
                if (json) sectionsFolder.file(`${item.id}.json`, json)
            }
        }

        // 3b. Immagini della copertina (da IndexedDB)
        const assetsFolder = zip.folder('assets')
        if (assetsFolder) {
            for (const assetId of collectAssetIds()) {
                const asset = await getAsset(assetId)
                if (asset) assetsFolder.file(`${assetId}.${EXT_BY_MIME[asset.type] ?? 'png'}`, asset.blob)
            }
        }

        // 4. Generiamo il pacchetto binario compresso pronto per il download
        return await zip.generateAsync({ type: 'blob' })
    }

    /**
     * Crea una nuova sezione (es. un nuovo capitolo)
     */
    function createNewSection(title: string, type: SectionType = 'chapter') {
        const id = `sec-${Math.random().toString(36).substr(2, 9)}`
        const newItem: SectionIndexItem = { id, type, title }

        sectionIndex.value.push(newItem)
        zippedSectionsCache.value[id] = JSON.stringify(
            type === 'cover'
                ? { id, html: '', trees: [], cover: createEmptyCover() }
                : { id, html: '' }
        )

        return id
    }

    /**
 * Estrae tutti gli attributi 'tree-id' o 'data-tree-id' presenti nel codice HTML di un capitolo
 */
    function extractTreeIdsFromHtml(html: string): string[] {
        if (!html) return []
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        const treeIds: string[] = []
        // Cerca i nodi custom del tree (modifica il selettore in base a come Tiptap serializza il nodo in HTML)
        const treeNodes = doc.querySelectorAll('chess-tree-block, [data-type="chess-tree-block"]')

        treeNodes.forEach((node) => {
            const id = node.getAttribute('tree-id') || node.getAttribute('data-tree-id')
            if (id) treeIds.push(id)
        })

        return treeIds
    }




    /**
 * Ripristina la sessione da IndexedDB al ricaricamento della pagina (F5)
 */
    async function restoreFromIndexedDB(): Promise<boolean> {
        try {
            const savedState = await db.bookState.get('current_book')
            if (!savedState) return false

            // 1. Ripristina metadati e indice capitoli
            metadata.value = { ...defaultMetadata(), ...savedState.metadata }
            sectionIndex.value = savedState.sectionIndex

            // 2. Recupera le sezioni salvate da Dexie
            const allSections = await db.sections.toArray()
            zippedSectionsCache.value = {}

            // 🟢 AGGIORNAMENTO: Mantiene la stringa JSON integra ({ id, html, trees })
            allSections.forEach(sec => {
                zippedSectionsCache.value[sec.id] = sec.json
            })

            // 3. Determina la sezione da caricare
            const sectionToOpen = savedState.activeSectionId || sectionIndex.value[0]?.id

            if (sectionToOpen) {
                // changeActiveSection farà il parse del JSON dalla cache e popolerà sia l'HTML che treeStore.trees
                await changeActiveSection(sectionToOpen)
            }

            isBookLoaded.value = true
            return true
        } catch (error) {
            console.error('Errore nel ripristino da IndexedDB:', error)
            return false
        }
    }

    function syncActiveSectionToCache(opts: { html?: string; prune?: boolean } = {}) {
        const id = activeSectionId.value
        if (!id) return

        // La copertina non ha HTML né partite: si salva il suo modello
        if (activeSectionInfo.value?.type === 'cover') {
            if (coverModel.value) {
                zippedSectionsCache.value[id] = JSON.stringify({
                    id, html: '', trees: [], cover: coverModel.value
                })
            }
            return
        }

        const treeStore = useChessTreeStore()
        const html = opts.html ?? activeSectionHtml.value

        let trees = treeStore.trees
        if (opts.prune) {
            // copia filtrata, NON modifica lo store
            const used = new Set(extractTreeIdsFromHtml(html))
            trees = trees.filter(t => used.has(t.id))
        }
        zippedSectionsCache.value[id] = JSON.stringify({ id, html, trees })
    }

    return {
        // Stato esistente
        activeFen,
        globalDiagramSize,
        insertSignal,
        // Nuovi segnali per Server
        exportServerChapterSignal,
        exportServerFullBookSignal,
        updateActiveFen,
        triggerInsertDiagram,
        // Nuovi trigger Server
        triggerServerChapterPdfExport,
        triggerServerFullBookPdfExport,

        // Nuovo Stato Strutturale
        isBookLoaded,
        metadata,
        sectionIndex,
        activeSectionId,
        activeSectionHtml,
        zippedSectionsCache,
        activeSectionInfo,
        generatedTocHtml,
        diagramLabels,
        diagramList,
        unresolvedDiagramRefs,

        // Nuove Funzioni operative
        changeActiveSection,
        loadMtcBook,
        exportMtcBook,
        createNewSection,

        // Funzioni di salvataggio e ripristino

        restoreFromIndexedDB,
        saveStatus,

        currentChapterNumber,
        syncActiveSectionToCache,

        startNewBook,

        coverModel,
        coverImageUrl,
        setCoverImage,
        removeCoverImage,
        buildCoverHtml,
        collectAssetIds,
    }
})