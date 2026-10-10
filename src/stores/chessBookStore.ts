import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import JSZip from 'jszip'
import { db } from '../db'
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
}


export const useChessBookStore = defineStore('chessBook', () => {
    // --- STATO ESISTENTE (Scacchiera e Segnali) ---
    const activeFen = ref('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    const globalDiagramSize = ref(28)
    const insertSignal = ref(0)
    const exportSignal = ref(0)
    const exportFullBookSignal = ref(0)

    // --- NUOVI SEGNALI PER ESPORTAZIONE SERVER (PLAYWRIGHT) ---
    const exportServerChapterSignal = ref(0)  // Esportazione Capitolo (Server)
    const exportServerFullBookSignal = ref(0) // Esportazione Libro (Server)

    const isBookLoaded = ref(false)
    const saveStatus = ref<SaveStatus>('saved')

    // --- NUOVO STATO (Metadati e Struttura Libro) ---
    const metadata = ref<BookMetadata>({
        version: '1.0.0',
        title: 'Nuovo Libro di Scacchi',
        author: 'Autore',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pageFormat: 'a4',
        isTwoColumns: false,
        showNumbering: true,
        // Nuovi campi per i margini di stampa
        pageMarginTop: 25,
        pageMarginRight: 20,
        pageMarginBottom: 25,
        pageMarginLeft: 20
    })

    // L'indice delle sezioni (caricato subito in Fase A)
    const sectionIndex = ref<SectionIndexItem[]>([])

    // L'ID della sezione attualmente aperta nell'editor
    const activeSectionId = ref<string | null>(null)

    // Il contenuto HTML della sola sezione attiva nell'editor (Fase B)
    const activeSectionHtml = ref<string>('')

    // Il "disco virtuale": tiene in memoria i file compressi non ancora aperti
    // Chiave: sectionId, Valore: la stringa JSON grezza o l'oggetto compresso da estrarre su richiesta
    const zippedSectionsCache = ref<Record<string, string>>({})

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

    // --- FUNZIONI ESISTENTI ---
    function updateActiveFen(fen: string) {
        activeFen.value = fen
    }

    function triggerInsertDiagram() {
        insertSignal.value++
    }

    function triggerPdfExport() {
        exportSignal.value++
    }

    function triggerFullBookPdfExport() {
        exportFullBookSignal.value++
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


        const cachedData = zippedSectionsCache.value[nextSectionId]
        let nextHtml = ''
        let nextTrees: ChessTree[] = []

        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData)
                nextHtml = parsed.html || ''
                nextTrees = parsed.trees || []
            } catch (e) {
                console.error('Errore nel parsing della sezione:', e)
            }
        }

        // Carica subito i tree nello store (PRIMA di iniettare l'HTML nell'editor)
        chessTreeStore.setChapterTrees(nextTrees)

        // 3. DOPO: Impostiamo l'ID e l'HTML per attivare il re-render dell'editor Tiptap
        activeSectionId.value = nextSectionId
        activeSectionHtml.value = nextHtml
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
            pageMarginLeft: bookData.pageMarginLeft !== undefined ? Number(bookData.pageMarginLeft) : 20
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
        zippedSectionsCache.value[id] = JSON.stringify({ id, html: '' })

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
            metadata.value = savedState.metadata
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
        exportSignal,
        exportFullBookSignal,
        // Nuovi segnali per Server
        exportServerChapterSignal,
        exportServerFullBookSignal,
        updateActiveFen,
        triggerInsertDiagram,
        triggerPdfExport,
        triggerFullBookPdfExport,
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

        // Nuove Funzioni operative
        changeActiveSection,
        loadMtcBook,
        exportMtcBook,
        createNewSection,

        // Funzioni di salvataggio e ripristino

        restoreFromIndexedDB,
        saveStatus,

        currentChapterNumber,
        syncActiveSectionToCache
    }
})