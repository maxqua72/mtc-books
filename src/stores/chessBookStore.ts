import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChessBookStore = defineStore('chessBook', () => {
  // Stato della scacchiera di analisi (destra)
  const activeFen = ref('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  
  // Dimensione globale di default (in pixel)
  const globalDiagramSize = ref(40)

  // Segnale di inserimento (contatore incrementale per attivare il watch nell'editor)
  const insertSignal = ref(0)

  // Segnale per l'esportazione pdf
  const exportSignal = ref(0)

  // Aggiorna il FEN corrente durante il movimento dei pezzi
  function updateActiveFen(fen: string) {
    activeFen.value = fen
  }

  // Innesca la richiesta di inserimento del diagramma nell'editor
  function triggerInsertDiagram() {
    insertSignal.value++
  }

  // Innesca la richiesta di inserimento del diagramma nell'editor
  function triggerPdfExport() {
    exportSignal.value++
  }

  return {
    activeFen,
    globalDiagramSize,
    insertSignal,
    exportSignal,
    updateActiveFen,
    triggerInsertDiagram,
    triggerPdfExport
  }
})