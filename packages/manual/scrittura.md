# Scrivere il testo

Il testo si scrive sul foglio al centro. I comandi sono nella barra degli strumenti; se la finestra è stretta, quelli che non entrano si aprono con il pulsante **Altri strumenti**.

## Carattere

- **Grassetto** (`Ctrl+B`), **Corsivo** (`Ctrl+I`), **Sottolineato** (`Ctrl+U`) ed **Evidenzia**.
- **Colore del testo**: la **✕** accanto ripristina il colore predefinito.

## Paragrafo

- **Stili del paragrafo**: **Testo normale**, **Titolo 1**, **Titolo 2**, **Titolo 3**.
- **Elenchi**: **Elenco puntato** ed **Elenco numerato**.
- **Allineamento** del paragrafo.
- **Aumenta rientro** (`Ctrl+]`) e **Riduci rientro** (`Ctrl+[`).

## Mosse nel testo

Mentre scrivi, le mosse in notazione inglese vengono riconosciute da sole: la lettera del pezzo diventa una figurina. Scrivendo `Nf3`, `Qxe5` o `Rad1` vedi il simbolo del cavallo, della donna o della torre. Vale anche per le promozioni, come `e8=Q`.

![Le mosse scritte nel testo mostrate con le figurine](/screenshots/mosse-nel-testo.png)

Le lettere usate sono `K`, `Q`, `R`, `B` e `N`. Una mossa dentro una parola più lunga non viene convertita.

## Dettare le mosse

Puoi scrivere il testo a voce con la dettatura del sistema: `Win+H` su Windows, **Dettatura** su macOS, il microfono della tastiera su tablet. La dettatura scrive le mosse come parole; il comando **Converti mosse** le trasforma poi in notazione, con le figurine.

### Come dettare

Detta ogni casa come colonna più traversa, usando per la colonna il nome di una città:

| Colonna | a | b | c | d | e | f | g | h |
|---|---|---|---|---|---|---|---|---|
| Parola | Ancona | Bologna | Como | Domodossola | Empoli | Firenze | Genova | Hotel |

- Traversa: un numero da uno a otto, per esempio «Empoli quattro» per `e4`.
- Pezzi: re, donna, torre, alfiere, cavallo, seguiti dalla casa: «cavallo Firenze tre» per `Nf3`. Per i pedoni basta la casa.
- Catture: «prende», «per», «cattura» o «mangia»: «donna prende Empoli cinque» per `Qxe5`, «Empoli prende Domodossola cinque» per `exd5`.
- Due pezzi uguali sulla stessa casa: aggiungi la colonna o la traversa di partenza, come in «cavallo Bologna Domodossola sette» per `Nbd7`.
- Promozione: «Empoli otto promuove a donna» per `e8=Q`.
- Scacco e matto in fondo alla mossa: «alfiere Bologna cinque scacco» per `Bb5+`, «donna Hotel sette matto» per `Qh7#`.
- Arrocchi: «arrocco corto» e «arrocco lungo».
- Numero di mossa: dillo prima della mossa, «due cavallo Firenze tre» per `2. Nf3`.

Dopo il nome di un pezzo va bene anche la sola lettera della colonna, se la dettatura la scrive così: «cavallo F tre».

Per esempio, la frase dettata

> Dopo uno Empoli quattro Empoli 5 2 cavallo Firenze tre il nero gioca cavallo Como sei poi alfiere Bologna 5 e infine a Rocco corto

diventa

> Dopo 1. e4 e5 2. Nf3 il nero gioca Nc6 poi Bb5 e infine O-O

### Convertire le mosse

1. Seleziona il testo da convertire, oppure metti il cursore nel paragrafo.
2. Clicca **Converti mosse**, il pulsante con il microfono fra i comandi scacchistici della barra degli strumenti (suggerimento «Converti in notazione le mosse dettate (selezione o paragrafo)»).
3. Nella finestra **Converti mosse** controlla le sostituzioni proposte: per ognuna vedi il testo originale evidenziato e il risultato con le figurine. Togli la spunta a quelle da lasciare come sono.
4. Scegli **Applica**, oppure **Annulla** per chiudere senza cambiare nulla.

![La finestra Converti mosse con le sostituzioni proposte](/screenshots/converti-mosse.png)

Se non ci sono mosse dettate, compare l'avviso «Nessuna mossa dettata trovata». I diagrammi e i blocchi di mosse non vengono toccati. Tutte le sostituzioni si annullano insieme con un solo `Ctrl+Z`.

## Link

1. Seleziona il testo e clicca **Link** (`Ctrl+K`).
2. Scrivi l'indirizzo e scegli **Applica**.

Senza selezione, come testo viene inserito l'indirizzo. Per togliere un link usa **Rimuovi link**. Per aprirlo dall'editor fai `Ctrl`+clic.

## Blocchi scacchistici

Nella stessa barra trovi i comandi per [alberi di mosse](./alberi-mosse) e riferimenti ai [diagrammi](./diagrammi#riferimenti-nel-testo).

## Zoom

Il selettore **Zoom** offre **Adatta larghezza** e valori dal 50% al 150%. Cambia solo la vista, non il libro.

## Annullare

`Ctrl+Z` e `Ctrl+Y` valgono per il testo. All'interno di un blocco di mosse non sono attivi: l'albero si gestisce dalla scacchiera e dalla console.

## Sola lettura

L'interruttore nell'intestazione passa da **Sola lettura** a **Modifica attiva**. In sola lettura il documento non si modifica, ma puoi leggerlo, navigare tra le mosse e analizzare con il motore.

I libri aperti da file partono in sola lettura, così non vengono toccati per sbaglio.

## Controllo ortografico

Si attiva nelle [impostazioni](./impostazioni#controllo-ortografico).
