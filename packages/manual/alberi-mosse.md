# Alberi di mosse

Un albero di mosse contiene una partita o una linea con le sue varianti. Nel testo appare come un blocco di notazione.

![Un blocco di notazione con commenti, una variante e la mossa selezionata](/screenshots/albero-mosse.png)

## Creare un albero

- **Inserisci blocco mosse** nella barra degli strumenti crea dopo il paragrafo del cursore un albero che parte dalla posizione della scacchiera.
- **+ Nuovo albero da questa posizione** nella console lo crea dopo l'albero attivo o dopo il punto del cursore.
- [L'importazione PGN](./import-pgn) crea alberi da partite esistenti.

Gli alberi stanno nei capitoli, non in copertina o nell'indice.

## Registrare le mosse

Clicca una mossa nel blocco per attivare l'albero, poi muovi sulla scacchiera. Se dalla posizione corrente esiste già un'altra mossa, quella nuova diventa una variante.

## Commenti

Seleziona una mossa e inizia a scrivere: il testo finisce nel suo commento. Con il cursore nel commento puoi inserire [riferimenti ai diagrammi](./diagrammi#riferimenti-nel-testo). Quanto incolli arriva come testo semplice.

## Simboli

Con una mossa selezionata e le modifiche attive, la scheda **Simboli** offre:

- **Qualità della mossa**: `!`, `?`, `!!`, `??`, `!?`, `?!`, `□`.
- **Valutazione della posizione**: `=`, `∞`, `+=`, `=+`, `+/-`, `-/+`, `+-`, `-+`, `+--`, `--+`.
- **Altri simboli**: `∆` con l'idea, `∇` contro l'idea, `N` novità teorica.

Nei primi due gruppi ogni mossa ha al massimo un simbolo: quello nuovo sostituisce il precedente. Passando sul pulsante leggi il significato.

![La scheda Simboli della console](/screenshots/simboli.png)

## Riordinare ed eliminare

I comandi nella console agiscono sulla linea della mossa selezionata.

| Comando | Effetto |
|---|---|
| **Promuovi** | Alza la mossa di un posto tra le alternative: la prima diventa linea principale |
| **Rendi principale** | Rende principale la linea, a ogni livello di annidamento |
| **Abbassa** | La fa scendere di un posto: se era la principale, diventa variante |
| **Elimina Variante** | Elimina la mossa selezionata e tutto ciò che la segue |

Il riordino non è disponibile su un albero diviso in più blocchi.

## Dividere e unire i blocchi

Dividi un blocco per inserire testo o un diagramma in mezzo a una linea.

- **Dividi blocco**: taglia dopo la mossa selezionata. In una variante, la continuazione e il ritorno alla linea madre vanno in nuovi blocchi.
- **Unisci blocchi**: unisce il blocco selezionato a quello che lo continua.

::: warning Operazioni non annullabili
Dividere e unire azzerano la cronologia di annulla e ripristina dell'editor. L'app chiede conferma.
:::

## Comandi del blocco

Passando sul blocco compaiono:

- **¶↑** e **¶↓**: inseriscono un paragrafo sopra o sotto.
- **Copia l'albero** e **Taglia l'albero**: poi incolla con `Ctrl+V` o con **Incolla albero** nella barra degli strumenti.
- **Elimina il blocco albero**, dopo conferma.

## Intestazione della partita

Se l'albero ha dati PGN, come giocatori ed evento, la barra di stato mostra **Mostra intestazione nel documento**.
