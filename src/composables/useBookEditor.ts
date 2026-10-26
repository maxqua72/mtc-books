// Creazione dell'editor Tiptap del libro e sincronizzazione con la sezione attiva
import { useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Focus from '@tiptap/extension-focus'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { EditorState } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/vue-3'
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { ChessDiagram } from '../extensions/ChessDiagram'
import { CustomHeading } from '../extensions/CustomHeading'
import { ChessTreeBlock } from '../extensions/ChessTreeBlock'
import { ProtectChessNodes } from '../extensions/ProtectChessNodes'
import { PgnInsertMarker } from '../extensions/PgnInsertMarker'
import { DiagramRef } from '../extensions/DiagramRef'
import { Indent } from '../extensions/Indent'
import { isTreeClipMarker } from '../utils/treeClipboard'
import { treeIdsInDoc } from '../utils/editorDoc'
import { pasteTreeFromClipboard } from './useBlockInsertion'

/** Azzera la cronologia annulla/ripristina: lo stato si ricrea con lo stesso documento e gli stessi plugin */
/*
const resetHistory = (ed: Editor) => {
  const { view } = ed
  view.updateState(EditorState.create({ doc: view.state.doc, plugins: view.state.plugins }))
  // transazione vuota: riallinea la toolbar (stato dei pulsanti) senza toccare il documento
  view.dispatch(view.state.tr.setMeta('addToHistory', false))
}*/
const resetHistory = (ed: Editor) => {
  try {
    const { view } = ed
    view.updateState(EditorState.create({ doc: view.state.doc, plugins: view.state.plugins }))
  } catch (e) {
    console.warn('[editor] Impossibile azzerare la cronologia annulla/ripristina:', e)
    return
  }

  // Riallinea la toolbar a node view già montate: un dispatch immediato farebbe emettere
  // selectionUpdate a node view appena create e non ancora pronte (race intermittente)
  requestAnimationFrame(() => {
    if (ed.isDestroyed) return
    try {
      ed.view.dispatch(ed.view.state.tr.setMeta('addToHistory', false))
    } catch (e) {
      console.warn('[editor] Riallineamento della toolbar non riuscito:', e)
    }
  })
}

/** Carica un documento diverso nell'editor (capitolo, indice): non deve essere annullabile */
const replaceContent = (ed: Editor, html: string, options?: { emitUpdate?: boolean }) => {
  ed.commands.setContent(html, options)
  resetHistory(ed)
}

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
        heading: false, // l'heading standard è sostituito da CustomHeading
        link: {
          openOnClick: false,
          autolink: true,          // un indirizzo digitato seguito da spazio diventa link
          defaultProtocol: 'https',
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        },
      }),
      Focus.configure({
        className: 'is-node-focused', // classe CSS applicata al blocco/nodo attivo
        mode: 'deepest',
      }),
      Highlight,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      Indent,
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
        const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
        if (anchor && (event.ctrlKey || event.metaKey)) {
          window.open(anchor.href, '_blank', 'noopener,noreferrer')
          return true
        }

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
      replaceContent(editor.value, store.generatedTocHtml)
      editor.value.setOptions({ editable: false })
      return
    }

    // La copertina è gestita da CoverEditor: l'editor di testo non va toccato
    if (section?.type === 'cover') return

    // Capitoli: editor modificabile (se il documento non è bloccato)
    editor.value.setOptions({ editable: !store.isLocked })

    // Capitolo vuoto: un h2 vuoto fa comparire subito il numero del capitolo, seguito da un paragrafo
    if (!store.activeSectionHtml || store.activeSectionHtml.trim() === '') {
      replaceContent(editor.value, '<h2></h2><p></p>')
      nextTick(() => editor.value?.commands.focus('start'))
    } else {
      replaceContent(editor.value, store.activeSectionHtml)
    }
  }

  // HTML nello store diverso da quello nell'editor (ripristino da IndexedDB, cambio sezione): si aggiorna l'editor.
  // emitUpdate:false evita che setContent faccia scattare di nuovo onUpdate.
  watch(() => store.activeSectionHtml, (newHtml) => {
    if (!editor.value) return
    if (newHtml && editor.value.getHTML() !== newHtml) {
      replaceContent(editor.value, newHtml, { emitUpdate: false })
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
      if (toc && editor.value) replaceContent(editor.value, toc, { emitUpdate: false })
    }
  )

  // Editor -> store, prima del salvataggio su file o dell'esportazione.
  // Con la copertina attiva l'editor di testo contiene un vecchio capitolo: non va sincronizzato.
  const syncEditorContent = () => {
    const type = store.activeSectionInfo?.type
    if (editor.value && type !== 'cover' && type !== 'index') {
      store.activeSectionHtml = editor.value.getHTML()
    }
  }

  const TREE_BLOCK = '.chess-tree-block-container'
  const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

  // Ctrl+Z / Ctrl+Y (anche Ctrl+Maiusc+Z):
  // - dentro un blocco albero (commenti compresi): sempre bloccati, l'albero si gestisce dalla scacchiera
  // - fuori da un campo modificabile: bloccati, per non attivare l'undo nativo del browser
  //   (la sua cronologia sopravvive al cambio capitolo e punta a nodi DOM ormai staccati)
  const blockStrayUndo = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    const key = e.key.toLowerCase()
    if (key !== 'z' && key !== 'y') return
    const target = e.target as HTMLElement | null
    if (target?.closest(TREE_BLOCK) || !target?.closest(EDITABLE)) e.preventDefault()
  }

  // Annulla/Ripristina dal menu Modifica o dal menu contestuale del browser:
  // non passano dalla tastiera ma da beforeinput
  const blockTreeHistoryInput = (e: InputEvent) => {
    if (e.inputType !== 'historyUndo' && e.inputType !== 'historyRedo') return
    if ((e.target as HTMLElement | null)?.closest(TREE_BLOCK)) e.preventDefault()
  }

  onMounted(() => {
    window.addEventListener('request-editor-sync', syncEditorContent)
    window.addEventListener('keydown', blockStrayUndo, true)
    window.addEventListener('beforeinput', blockTreeHistoryInput, true)

    // Libro senza sezioni all'avvio: se ne crea una di default
    if (store.sectionIndex.length === 0) {
      const defaultId = store.createNewSection('Capitolo 1 — Introduzione', 'chapter')
      store.changeActiveSection(defaultId, editor.value?.getHTML())
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('request-editor-sync', syncEditorContent)
    window.removeEventListener('keydown', blockStrayUndo, true)
    window.removeEventListener('beforeinput', blockTreeHistoryInput, true)
  })

  return { editor, syncEditorContent }
}
