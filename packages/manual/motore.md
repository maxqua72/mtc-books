# Motore di analisi

::: info Solo app desktop
La versione web non ha il motore.
:::

MTC Books usa un motore scacchistico UCI già presente sul computer, ad esempio Stockfish. Il motore non è incluso e l'app non lo scarica: lo trovi nella [pagina di download di Stockfish](https://stockfishchess.org/download/).

Analisi e valutazioni non entrano nel file `.mtcbook` né nel PDF. Il motore è un'impostazione dell'app, non del libro.

## Configurare un motore

Nella scheda **Motore** della console:

- **Scegli motore…** indica il programma. L'app verifica che risponda come motore UCI.
- **Cerca Stockfish** lo cerca nelle cartelle comuni; con **Aggiungi** lo inserisci nell'elenco.

Puoi configurare più motori, ma ne è attivo uno alla volta. In **Motori configurati** scegli quale usare, lo rinomini, indichi gli **Argomenti di avvio** o usi **Rimuovi**. Rimuovere un motore non cancella il programma dal computer.

## Avviare l'analisi

Usa l'interruttore in alto nel pannello. Lo stato può essere **Spento**, **Avvio in corso…**, **Pronto**, **In analisi**, **Errore** o **Interrotto**.

L'analisi segue la posizione della scacchiera e funziona anche in sola lettura. Ogni linea mostra valutazione e mosse su una sola riga: se le mosse non ci stanno finiscono con «…». Clicca le mosse per vedere tutta la linea; un altro clic la riduce di nuovo a una riga. La valutazione è dal punto di vista del Bianco: un numero positivo indica vantaggio del Bianco.

![Il pannello Motore con Stockfish in analisi](/screenshots/motore.png)

## Usare le linee

- **+** aggiunge la linea all'albero come variante. Serve una mossa selezionata in un albero, con le modifiche attive.
- **Aggiungi** stabilisce quante mosse inserire: 4, 8 o 12 mezze mosse, oppure tutta la linea.
- **Salva freccia nella posizione** conserva la freccia della mossa migliore.

## Impostazioni del motore

Le opzioni dipendono dal motore. Quelle principali, se disponibili, sono **Numero di linee**, **Thread (processori)**, **Memoria hash (MB)**, **Livello di abilità (0–20)**, **Limita la forza di gioco**, **Elo (con forza limitata)** e **Cartella delle tabelle Syzygy**. Le altre sono in **Avanzate**.

**Valori consigliati** propone thread e hash adatti al computer. **Ripristina predefiniti** torna ai valori del motore.

Nella parte **Analisi** trovi:

- **Modalità**: **Continua finché non cambi posizione**, **Fino a una profondità**, **Per un tempo fisso**.
- **Freccia della mossa migliore sulla scacchiera**.
- **Avvia il motore all'apertura dell'app**.

## Se il motore si ferma

In caso di errore o di chiusura inattesa il pannello mostra il messaggio. Il riavvio è manuale: usa di nuovo l'interruttore.
