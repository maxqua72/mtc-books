<template>
  <div class="flex-1 bg-white border border-neutral-200 rounded-xl flex flex-col shadow-sm overflow-hidden">
    
    <!-- Inserimento della Toolbar Modulare -->
    <EditorToolbar v-if="editor" :editor="editor" />

    <!-- Area di Scrittura Effettiva -->
    <div id="book-editor-content" class="flex-1 p-8 overflow-y-auto">
      <div class="max-w-2xl w-full mx-auto">
        <editor-content :editor="editor" />
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { watch } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'
import { ChessDiagram } from '../extensions/ChessDiagram'
import EditorToolbar from './EditorToolbar.vue'

// @ts-ignore
import html2pdf from 'html2pdf.js'

const store = useChessBookStore()

const editor = useEditor({
  content: `
    <h2>Capitolo 1 — Introduzione</h2>
    <p>Questo è il testo del tuo nuovo libro sugli scacchi. Puoi selezionare il testo per formattarlo in <strong>grassetto</strong> o <em>corsivo</em> utilizzando la toolbar superiore.</p>
    <p>Muovi i pezzi sulla destra per impostare una variante, posiziona il cursore del testo qui sotto e premi il bottone nero sulla console.</p>
  `,
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [2, 3]
      }
    }),
    ChessDiagram, // <-- Registriamo l'estensione del nostro diagramma scacchistico
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-neutral font-serif text-lg text-neutral-800 focus:outline-none leading-relaxed max-w-none',
    },
  },
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
  const originalElement = document.getElementById('book-editor-content')
  if (!originalElement) return

  // 1. CLONAZIONE MANUALE PRE-RENDERING
  // Creiamo una copia profonda del contenuto fuori dal DOM per manipolarlo liberamente
  const containerClone = originalElement.cloneNode(true) as HTMLElement

  // 2. FORZATURA STRUTTURALE DELL'ALTEZZA
  // Eliminiamo radicalmente lo scrollbar e forziamo l'altezza automatica sul contenitore principale
  containerClone.style.setProperty('height', 'auto', 'important')
  containerClone.style.setProperty('max-height', 'none', 'important')
  containerClone.style.setProperty('overflow', 'visible', 'important')
  containerClone.style.setProperty('position', 'relative', 'important')

  // Facciamo lo stesso per il contenitore interno di Tiptap (la classe .max-w-2xl o simili)
  const internalContainer = containerClone.querySelector('.max-w-2xl') as HTMLElement
  if (internalContainer) {
    internalContainer.style.setProperty('height', 'auto', 'important')
    internalContainer.style.setProperty('max-height', 'none', 'important')
    internalContainer.style.setProperty('overflow', 'visible', 'important')
  }

  // 3. PULIZIA ELEMENTI INTERFACCIA
  // Rimuoviamo i menu a comparsa dei diagrammi scacchi per non stamparli nel PDF
  containerClone.querySelectorAll('.diagram-actions-menu').forEach(menu => menu.remove())

  // 4. CONFIGURAZIONE OPZIONI HTML2PDF
  const options = {
    margin:       20, 
    filename:     'libro_scacchi.pdf',
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { 
      scale: 2, 
      useCORS: true, 
      logging: false,
      // Usiamo scrollY a 0 per evitare disallineamenti se l'utente ha scansionato la pagina verso il basso
      scrollY: 0,
      onclone: (clonedDoc: Document) => {
        // Iniettiamo i fogli di stile tipografici nel documento temporaneo di stampa
        const styleTag = clonedDoc.createElement('style')
        styleTag.innerHTML = `
          #book-editor-content { 
            background-color: #ffffff !important; 
            color: #171717 !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
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
    jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
    pagebreak:    { mode: ['css', 'legacy'] as const } 
  }
  
  // 5. GENERA IL PDF PASZANDO IL CLONE SROTOLATO
  // Alimentiamo html2pdf direttamente con il nostro elemento clonato e modificato
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
</script>

<style>
.tiptap h2 {
  font-size: 2.25rem;
  font-weight: 700;
  color: #171717;
  margin-bottom: 0.5rem;
  font-family: Georgia, Cambria, serif;
}
.tiptap h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #262626;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  font-family: Georgia, Cambria, serif;
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
.tiptap p:empty::before, [placeholder]:empty::before {
  content: attr(placeholder);
  float: left;
  color: #a3a3a3;
  pointer-events: none;
  height: 0;
}
</style>