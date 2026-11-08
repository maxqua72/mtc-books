# Requisiti: conversione delle mosse dettate

## 1. Contesto e obiettivo

Gli autori possono scrivere il testo del libro con la dettatura del sistema operativo: Win+H su Windows, Dettatura su macOS, microfono della tastiera su tablet. Funziona già nell'editor, sia nella versione web sia in quella desktop. La dettatura generica però non conosce la notazione scacchistica, quindi le mosse arrivano come parole.

Con una semplice convenzione di dettatura (§3) il testo prodotto è pulito e regolare. Esempio reale prodotto da Win+H:

> Dopo uno Empoli quattro Empoli 5 2 cavallo Firenze tre il nero gioca cavallo Como sei poi alfiere Bologna 5 e infine a Rocco corto

La funzione da realizzare è il comando **Converti mosse**. Riconosce queste sequenze di parole e, dopo la conferma dell'utente in un'anteprima, le sostituisce con la notazione algebrica inglese già usata nel testo:

> Dopo 1. e4 e5 2. Nf3 il nero gioca Nc6 poi Bb5 e infine O-O

Le lettere dei pezzi diventano poi figurine da sole, grazie all'estensione `Figurines` esistente.

La funzione non fa riconoscimento vocale: lavora solo sul testo già presente nell'editor. Vale identica su web e desktop.

## 2. Requisiti funzionali: interfaccia

**RF-1. Comando.** Nella barra degli strumenti dell'editor (`EditorToolbar.vue`), nel gruppo dei comandi scacchistici, c'è un pulsante **Converti mosse** con tooltip «Converti in notazione le mosse dettate (selezione o paragrafo)». Come gli altri pulsanti, deve funzionare anche nel pannello **Altri strumenti** quando la finestra è stretta. È disabilitato quando l'editor è bloccato (`locked`).

**RF-2. Ambito.**
- Con una selezione non vuota, il comando analizza solo il testo selezionato.
- Senza selezione, analizza il paragrafo (blocco di testo) in cui si trova il cursore.
- Il contenuto dei nodi protetti `chessDiagram` e `chessTreeBlock` (vedi `ProtectChessNodes.ts`) non viene mai analizzato né modificato, nemmeno quando è dentro la selezione.

**RF-3. Anteprima.** Se trova almeno una mossa, il comando apre una finestra modale basata su `BaseModal`, intitolata **Converti mosse**, che elenca le sostituzioni proposte. Per ognuna mostra:
- un breve contesto del testo originale, con la parte da sostituire evidenziata;
- il risultato, visualizzato con le figurine, come apparirà nel libro;
- una casella di spunta, selezionata per default.

In fondo ci sono i pulsanti **Applica** (applica le sole voci spuntate) e **Annulla**.

**RF-4. Nessun risultato.** Se non trova mosse, il comando non apre la finestra e mostra un breve avviso: «Nessuna mossa dettata trovata». Va usato il meccanismo di avviso già presente nell'app, se c'è.

**RF-5. Applicazione.**
- Tutte le sostituzioni scelte vengono applicate in **una sola transazione**, così un solo `Ctrl+Z` le annulla tutte.
- Il testo sostituito mantiene la formattazione (marks) del primo carattere dell'intervallo originale.
- Una sostituzione non deve mai attraversare un nodo inline (per esempio `diagramRef`). Un intervallo che lo contiene semplicemente non viene riconosciuto.
- Se il documento è cambiato tra l'apertura dell'anteprima e **Applica**, le proposte vanno ricalcolate o la finestra va chiusa con un avviso. Non si devono mai applicare posizioni non più valide.

## 3. Requisiti funzionali: riconoscimento

### 3.1 Convenzione di dettatura

| Elemento | Parole riconosciute (maiuscole/minuscole indifferenti) | Risultato |
|---|---|---|
| Colonne | Ancona, Bologna, Como, Domodossola, Empoli, Firenze, Genova, Hotel | a … h |
| Traverse | `1`–`8` in cifre, oppure uno/un, due, tre, quattro, cinque, sei, sette, otto | 1 … 8 |
| Pezzi | re · donna, regina · torre · alfiere, alfieri · cavallo, cavalli | K · Q · R · B · N |
| Pedone | «pedone» davanti a una casa è facoltativo e viene eliminato | — |
| Cattura | prende, per, cattura, mangia | x |
| Scacco / matto | scacco · matto, scacco matto | + · # |
| Promozione | promuove, promuove a, promuove in, promozione a/in, uguale | = |
| Arrocchi | arrocco corto · arrocco lungo | O-O · O-O-O |

Una **casa** è sempre colonna + traversa, come due parole consecutive: «Empoli quattro» → `e4`, «Firenze 3» → `f3`.

### 3.2 Forme da riconoscere

**RR-1. Mossa di pedone.** casa → `e4`. «pedone Empoli quattro» → `e4`.

**RR-2. Mossa di pezzo.** pezzo + casa → `Nf3`.

**RR-3. Cattura.**
- pezzo + parola di cattura + casa → `Qxe5`.
- Di pedone: colonna + parola di cattura + casa, per esempio «Empoli prende Domodossola cinque» → `exd5`.

**RR-4. Disambiguazione.**
- pezzo + colonna + casa → `Nbd7`.
- pezzo + traversa + casa → `R1e1`.
- Entrambe le forme si possono combinare con la cattura → `Nbxd7`.

**RR-5. Promozione.** casa (o cattura di pedone) + parola di promozione + pezzo → `e8=Q`, `exd8=N`.

**RR-6. Scacco e matto.** In coda a una qualsiasi mossa → `Bb5+`, `Qh7#`.

**RR-7. Arrocchi.** Devono essere tolleranti agli errori di trascrizione osservati e simili: «a Rocco corto», «a rocco cotto», «arroco corto», «arrocco corta», «arrocco lungo», «a rocco lunga».
- Corto → `O-O`, lungo → `O-O-O`.
- Si può combinare con scacco o matto.
- La tolleranza va implementata con un elenco esplicito di varianti e regole precise, non con una distanza di edit generica, per non convertire frasi normali.

**RR-8. Numero di mossa.** Un numero, in cifre o in parole fino ad almeno «trenta», seguito subito da una mossa riconosciuta diventa `N.`: «uno Empoli quattro» → `1. e4`, «2 cavallo Firenze tre» → `2. Nf3`. Un numero **non** seguito da una mossa resta invariato, per esempio «nel 1972».

**RR-9. Formato di uscita.**
- Notazione algebrica inglese (K, Q, R, B, N), compatibile con l'espressione regolare `MOVE_RE` di `utils/figurines.ts`, così le figurine appaiono senza altro intervento.
- Il numero di mossa è seguito da uno spazio (`1. e4`), come in `ChessMoveRenderer.vue`.
- Lo spazio fra due mosse consecutive è uno solo.
- Il testo non riconosciuto tra le mosse resta invariato («il nero gioca», «poi», «e infine»).

**RR-10. Punteggiatura e maiuscole.** La dettatura inserisce maiuscole e talvolta virgole o punti.
- Le maiuscole non contano mai.
- La punteggiatura **dentro** una sequenza (per esempio «cavallo, Firenze tre») è tollerata e scompare.
- La punteggiatura **dopo** la mossa resta: «… arrocco corto.» → «… O-O.».

**RR-11. Lettera semplice dopo un pezzo (tolleranza aggiuntiva).** Dopo il nome di un pezzo si accetta come colonna anche una singola lettera a–h, perché la dettatura la scrive spesso correttamente: «cavallo F tre» → `Nf3`. Questa forma vale **solo** dopo il nome di un pezzo, mai da sola, perché «e», «a» e simili sono parole comuni.

### 3.3 Cosa NON va convertito

**RN-1.** Il nome di un pezzo non seguito da una casa: «la donna è il pezzo più forte», «il cavallo in c6 è debole».

**RN-2.** Il nome di una città non seguito da una traversa: «nel 1950 a Firenze».

**RN-3.** Testo già in notazione (`Nf3`, `1. e4`), che va lasciato invariato, così il comando è idempotente: applicarlo due volte di seguito non cambia nulla.

**RN-4.** Le forme senza città fuori dal caso RR-11: «C sei», «e quattro», «alfieri più 5». Sono trascrizioni troppo ambigue.

Alcuni falsi positivi sono inevitabili (per esempio «Firenze 3 volte»). È accettabile proprio perché c'è l'anteprima con le caselle di spunta.

## 4. Requisiti non funzionali e architettura

**RNF-1. Parser puro.** Il riconoscimento va in un modulo TypeScript puro, per esempio `packages/app/src/utils/dictatedMoves.ts`, senza dipendenze da Vue, TipTap o DOM.
- Riceve una stringa.
- Restituisce l'elenco delle sostituzioni `{ start, end, original, replacement }` con indici nella stringa.

**RNF-2. Integrazione con l'editor.** Il collegamento all'editor va in un composable, per esempio `composables/useConvertDictatedMoves.ts`, e la finestra in un componente dedicato, per esempio `components/DictatedMovesModal.vue`.
- Per leggere il testo dei blocchi con indici che corrispondono alle posizioni ProseMirror, si usa la stessa tecnica di `Figurines.ts`: `textBetween` con `'￼'` per i nodi inline.
- Le sostituzioni si applicano dall'ultima alla prima, per non dover rimappare le posizioni.

**RNF-3. Regole dei pacchetti.** Vanno rispettate le regole di dipendenza tra pacchetti (`pnpm check:boundaries`). Non servono nuove dipendenze npm.

**RNF-4. Leggibilità delle regole.** Il vocabolario (città, numeri, pezzi, parole di cattura e promozione, varianti di arrocco) sta in tabelle costanti facili da estendere, separate dalla logica.

## 5. Test

I test automatici vanno in `packages/app/tests/dictatedMoves.test.ts` e usano lo stesso stile degli altri test del pacchetto (`tsx --test`, `node:test`). Devono coprire almeno i casi seguenti.

**T-1. Caso reale (obbligatorio):**
- Ingresso: `Dopo uno Empoli quattro Empoli 5 2 cavallo Firenze tre il nero gioca cavallo Como sei poi alfiere Bologna 5 e infine a Rocco corto`
- Uscita: `Dopo 1. e4 e5 2. Nf3 il nero gioca Nc6 poi Bb5 e infine O-O`

**T-2.** Ogni forma da RR-1 a RR-11, con almeno un esempio positivo ciascuna, comprese cattura con disambiguazione, promozione con cattura e matto dopo un arrocco.

**T-3.** Ogni caso da RN-1 a RN-4 lasciato invariato.

**T-4.** Idempotenza: convertire il risultato di T-1 non produce sostituzioni.

**T-5.** Punteggiatura e maiuscole come da RR-10.

## 6. Manuale utente

Seguendo `CLAUDE.md`, nello stesso commit:

- In `packages/manual/scrittura.md`, dopo «Mosse nel testo», va aggiunta una sezione **Dettare le mosse**, senza dettagli tecnici e con le etichette esatte dell'interfaccia. Deve spiegare:
  - come avviare la dettatura del sistema (Win+H su Windows, Dettatura su macOS);
  - la tabella delle città per le colonne;
  - un esempio di frase dettata e il risultato;
  - l'uso del comando **Converti mosse** con l'anteprima.

  La funzione vale su web e desktop, quindi **non** serve il riquadro `::: info` per le funzioni solo desktop.
- Se si aggiunge una scorciatoia da tastiera, va verificato che non sia già usata e va aggiornato `scorciatoie.md`.
- La barra degli strumenti cambia aspetto: va aggiornato `packages/manual/scripts/capture.mjs` se serve e segnalato di rigenerare gli screenshot.

## 7. Criteri di completamento

- Tutti i test passano.
- Passano i comandi della sezione «Verifica prima del commit» del README: `pnpm check:boundaries`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Verifica manuale nell'app con la frase di T-1: anteprima corretta, figurine visibili dopo **Applica**, un solo `Ctrl+Z` riporta il testo originale.

## 8. Fuori ambito

- Riconoscimento vocale integrato nell'app (pulsante microfono, Web Speech API, Whisper).
- Verifica di legalità delle mosse: nella prosa non c'è una posizione di riferimento.
- Mosse del nero con numerazione `1... e5`, segni di valutazione (`!`, `?`, NAG), notazione con lettere italiane (C, A, T, D, R).
- Conversione automatica mentre si scrive.

## 9. Decisioni aperte (da confermare con l'autore prima o durante lo sviluppo)

- Scorciatoia da tastiera per **Converti mosse**: se serve, quale.
- Icona del pulsante: in linea con quelle esistenti nella barra.
