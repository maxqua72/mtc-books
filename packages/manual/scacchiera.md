# Scacchiera e console

La colonna destra contiene la scacchiera, i comandi di navigazione e la console.

![La colonna destra con scacchiera, barra di stato e console](/screenshots/console-fen.png)

## Posizione libera e albero collegato

La barra di stato sopra la console dice dove finiscono le mosse.

- **Posizione libera**: le mosse sono temporanee e non entrano nel documento.
- **Albero: nome**: le mosse vengono registrate in quell'albero.

**Scollega** stacca la scacchiera dall'albero: la posizione resta, ma le mosse non vengono più registrate. Anche un clic nel testo, fuori da alberi e diagrammi, torna alla posizione libera.

## Navigare

| Comando | Tasto |
|---|---|
| Inizio | `Home` |
| Variante precedente | `↑` |
| Mossa precedente | `←` |
| Mossa successiva | `→` |
| Variante successiva | `↓` |
| Fine della linea | `Fine` |

I tasti funzionano con un albero attivo o con il mouse sopra scacchiera e console, ma non mentre scrivi in un campo di testo. Il pulsante centrale inverte la scacchiera.

## Promozione

Scegli il pezzo con il mouse, oppure premi `Q`, `R`, `B` o `N`. `Esc` annulla la mossa.

## Frecce, cerchi e X

Disegnali sulla scacchiera con il tasto destro: nel libro risultano neri. Con `Maiusc` o `Ctrl` premuti risultano grigi. **Cancella frecce** li rimuove dalla posizione.

| Gesto | Risultato |
|---|---|
| Trascinare con il tasto destro da una casa all'altra | Freccia |
| Clic destro su una casa | Cerchio |
| Secondo clic destro sulla stessa casa, con lo stesso colore | Il cerchio diventa una X dello stesso colore |
| Terzo clic destro sulla stessa casa | La casa torna vuota |

Un clic con l'altro colore cambia il colore del cerchio. Per una X di un altro colore, ripeti il ciclo con quel colore.

Frecce, cerchi e X restano nella mossa dell'albero e passano ai diagrammi che inserisci, nell'editor e nel PDF. I marcatori di un PGN importato (`[%csl …]`) arrivano come cerchi: il formato PGN non prevede la X.

## Schede della console

- **FEN**: mostra, copia e accetta una posizione.
- **Importa PGN**: vedi [Importare un PGN](./import-pgn).
- **Motore**: solo app desktop, vedi [Motore di analisi](./motore).
- **Simboli**: compare quando puoi annotare la mossa, vedi [Simboli](./alberi-mosse#simboli).

### FEN

**Copia FEN** copia la posizione. Incollando un FEN nel campo imposti la posizione libera oppure, in un albero vuoto, la sua posizione iniziale. Un albero con la posizione già fissata non cambia: per partire da un'altra posizione crea un nuovo albero.

## Editor scacchiera

Dalla scheda **FEN** scegli **Editor scacchiera** per comporre una posizione.

![L’editor scacchiera](/screenshots/editor-scacchiera.png)

- Trascina un pezzo sulla scacchiera, oppure sceglilo e clicca sulle case.
- **Sposta** muove i pezzi; trascinandone uno fuori dalla scacchiera lo togli.
- **Togli** rimuove il pezzo dalla casa cliccata.
- **Posizione iniziale** e **Svuota** preparano la scacchiera.
- **Tratto**, **Mossa numero** e le caselle degli arrocchi completano la posizione.

**Applica** è disponibile solo se la posizione è valida. **Annulla** o `Esc` chiudono senza cambiare nulla.
