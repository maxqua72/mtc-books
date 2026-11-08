// Estensioni dell'editor del Taccuino: testo semplice, diagrammi e linee di mosse.
// I nodi sono gli stessi del libro (stesso HTML), con viste semplificate per il tocco.
import StarterKit from '@tiptap/starter-kit'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { ChessDiagram } from '../extensions/ChessDiagram'
import { ChessTreeBlock } from '../extensions/ChessTreeBlock'
import { ProtectChessNodes } from '../extensions/ProtectChessNodes'
import { Figurines } from '../extensions/Figurines'
import NoteDiagramView from './NoteDiagramView.vue'
import NoteLineView from './NoteLineView.vue'


export const noteExtensions = () => [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
    link: false,
  }),
  ChessDiagram.extend({ addNodeView: () => VueNodeViewRenderer(NoteDiagramView) }),
  ChessTreeBlock.extend({ addNodeView: () => VueNodeViewRenderer(NoteLineView) }),
  ProtectChessNodes,
  Figurines,
]
