// Creazione dell'editor Tiptap del libro e sincronizzazione con la sezione attiva
import { useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Focus from '@tiptap/extension-focus'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { ChessDiagram } from '../extensions/ChessDiagram'
import { CustomHeading } from '../extensions/CustomHeading'
import { ChessTreeBlock } from '../extensions/ChessTreeBlock'
import { ProtectChessNodes } from '../extensions/ProtectChessNodes'
import { PgnInsertMarker } from '../extensions/PgnInsertMarker'
import { DiagramRef } from '../extensions/DiagramRef'
import { isTreeClipMarker } from '../utils/treeClipboard'
import { treeIdsInDoc } from '../utils/editorDoc'
import { pasteTreeFromClipboard } from './useBlockInsertion'

const DEFAULT_CONTENT = `
  <h2>Capitolo 1 — Introduzione</h2>
  <p>Questo è il testo del tuo nuovo libro sugli scacchi. Puoi selezionare il testo per formattarlo in <strong>grassetto</strong> o <em>corsivo</em> utilizzando la toolbar superiore.</p>
  <p>Muovi i pezzi sulla destra per impostare una variante, posiziona il cursore del testo qui sotto e premi il bottone nero sulla console.</p>
`

export function useBookEditor() {
  const store = useChessBookStore()
  const treeStore = useChessTreeStore()

  const editor = useEditor({
    content: store.activeSectionHtml || DEFAULT_CONTENT,
    editable: !store.isLocked,
    extensions: [
      StarterKit.configure({
        heading: false // l'heading standard è sostituito da CustomHeading
      }),
      Focus.configure({
        className: 'is-node-focused', // classe CSS applicata al blocco/nodo attivo
        mode: 'deepest',
      }),
      TextStyle,
      Color,
      CustomHeading,
      ChessDiagram,
      ChessTreeBlock,
      ProtectChessNodes,
      DiagramRef,
      PgnInsertMarker,
    ],
    editorProps: {
      attributes: {
        class: 'book-text-engine focus:outline-none max-w-none',
      },
      // Ctrl+V dopo "Copia" o "Taglia" su un albero: incolla un nuovo blocco al cursore
      handlePaste(_view, event) {
        if (treeStore.clipboard && isTreeClipMarker(event.clipboardData?.getData('text/plain') ?? '')) {
          pasteTreeFromClipboard()
          return true
        }
        return false
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
    // Durante la digitazione lo store riceve l'HTML aggiornato (base dell'autosave)
    onUpdate({ editor }) {
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

  const loadSectionIntoEditor = (sectionId: string | null) => {
    if (!sectionId || !editor.value) return

    const section = store.sectionIndex.find(s => s.id === sectionId)

    // Indice: contenuto generato, editor di sola lettura (si autogestisce)
    if (section?.type === 'index') {
      editor.value.commands.setContent(store.generatedTocHtml)
      editor.value.setOptions({ editable: false })
      return
    }

    // La copertina è gestita da CoverEditor: l'editor di testo non va toccato
    if (section?.type === 'cover') return

    // Capitoli: editor modificabile (se il documento non è bloccato)
    editor.value.setOptions({ editable: !store.isLocked })

    // Capitolo vuoto: un h2 vuoto fa comparire subito il numero del capitolo, seguito da un paragrafo
    if (!store.activeSectionHtml || store.activeSectionHtml.trim() === '') {
      editor.value.commands.setContent('<h2></h2><p></p>')
      nextTick(() => editor.value?.commands.focus('start'))
    } else {
      editor.value.commands.setContent(store.activeSectionHtml)
    }
  }

  // HTML nello store diverso da quello nell'editor (ripristino da IndexedDB, cambio sezione): si aggiorna l'editor.
  // emitUpdate:false evita che setContent faccia scattare di nuovo onUpdate.
  watch(() => store.activeSectionHtml, (newHtml) => {
    if (!editor.value) return
    if (newHtml && editor.value.getHTML() !== newHtml) {
      editor.value.commands.setContent(newHtml, { emitUpdate: false })
    }
  })

  // Sezione cambiata dall'esterno (barra laterale, apertura file)
  watch(() => store.activeSectionId, (id) => loadSectionIntoEditor(id))

  // Sola lettura: l'editor si blocca (l'indice resta sempre non modificabile)
  watch(() => store.isLocked, (locked) => {
    if (editor.value && store.activeSectionInfo?.type === 'chapter') editor.value.setEditable(!locked, false)
  })

  // L'editor viene creato dopo il montaggio: al primo istante i watcher sopra non scattano
  watch(editor, (ed) => {
    if (ed) loadSectionIntoEditor(store.activeSectionId)
  }, { immediate: true })

  // Indice aperto e capitoli modificati: si aggiorna lo schermo
  watch(
    () => store.activeSectionInfo?.type === 'index' ? store.generatedTocHtml : null,
    (toc) => {
      if (toc && editor.value) editor.value.commands.setContent(toc, { emitUpdate: false })
    }
  )

  // Editor -> store, prima del salvataggio su file o dell'esportazione.
  // Con la copertina attiva l'editor di testo contiene un vecchio capitolo: non va sincronizzato.
  const syncEditorContent = () => {
    if (editor.value && store.activeSectionInfo?.type !== 'cover') {
      store.activeSectionHtml = editor.value.getHTML()
    }
  }

  onMounted(() => {
    window.addEventListener('request-editor-sync', syncEditorContent)

    // Libro senza sezioni all'avvio: se ne crea una di default
    if (store.sectionIndex.length === 0) {
      const defaultId = store.createNewSection('Capitolo 1 — Introduzione', 'chapter')
      store.changeActiveSection(defaultId, editor.value?.getHTML())
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('request-editor-sync', syncEditorContent)
  })

  return { editor, syncEditorContent }
}
