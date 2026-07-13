export interface ChessMoveNode {
  id: string;          // UUID o stringa univoca per il tracciamento bidirezionale con Tiptap
  san: string;         // Es. "Nf6", "e4", "O-O"
  fen: string;         // FEN risultante dopo questa mossa
  moveNumber: number;  // Numero della mossa (es. 1, 2, 3...)
  color: 'w' | 'b';    // Colore del giocatore che ha mosso
  parentId: string | null; // ID del nodo precedente (null se è la prima mossa dell'albero)
  children: ChessMoveNode[]; // Array di nodi figli. children[0] = linea principale, children[1+] = varianti
}

export interface ChessTree {
  id: string;          // ID univoco dell'albero all'interno del capitolo
  title: string;       // Titolo/Identificativo dell'albero (es. "Linea Principale", "Partita Rossi-Bianchi")
  startingFen: string; // FEN di partenza (default: posizione iniziale degli scacchi)
  rootNodes: ChessMoveNode[]; // Le mosse iniziali possibili a partire dal startingFen
}