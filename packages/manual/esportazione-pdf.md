# Esportare in PDF

::: info Solo app desktop
Dalla versione web, salva il file `.mtcbook` e aprilo con l'app desktop.
:::

## Scegliere cosa esportare

Il pulsante di esportazione in alto esegue l'ultima scelta; la freccia accanto la cambia.

![Il menu di esportazione](/screenshots/menu-esporta.png)

- **Esporta Capitolo (PDF)**: esporta la sezione aperta.
- **Esporta Libro (PDF)**: esporta tutte le sezioni nell'ordine dell'elenco.

Con la copertina aperta, **Esporta Capitolo** produce solo la copertina. L'indice generale e gli indici delle partite e dei giocatori si esportano solo con il libro intero, perché i numeri di pagina si calcolano lì.

## Prima di esportare

- Scegli formato e spaziatura nelle [proprietà del libro](./struttura-libro#proprieta-del-libro).
- Se esistono riferimenti a diagrammi eliminati, l'app lo segnala e chiede se continuare.

Durante l'esportazione del libro vedi quale sezione è in lavorazione.

## Misure del PDF

Il PDF ha le misure del **Formato di Stampa** scelto. In A4, Crown Quarto e B-Format il testo è a 11 pt e i margini sono quelli del libro, con lo spazio per la [rilegatura](./struttura-libro#rilegatura) se l'hai scelto; i diagrammi hanno la misura prevista per il formato.

::: warning Libri già esportati in Crown Quarto o B-Format
Le versioni precedenti dell'app riducevano il contenuto per farlo stare nel foglio. Se esporti di nuovo uno di questi libri, il testo è più grande e le pagine aumentano: a parità di contenuto, circa il 40% in più in Crown Quarto e poco più del doppio in B-Format. Ricontrolla l'impaginazione e l'indice. I PDF in A4 non cambiano.
:::

Il tema dell'interfaccia non cambia il PDF: il foglio è sempre stampato su fondo bianco.

## Numeri di pagina

Il libro intero si numera come i libri stampati:

| Pagine | Numero |
|---|---|
| Copertina e quarta di copertina | Nessuno |
| Indice e [sezioni senza numero](./struttura-libro#sezioni-senza-numero) prima dei capitoli | Numeri romani: i, ii, iii… |
| Dal primo capitolo alla fine | Numeri arabi da 1 |

L'indice riporta gli stessi numeri stampati sulle pagine. Un capitolo esportato da solo si numera da 1.

Il numero sta in basso al centro. Con la [rilegatura](./struttura-libro#rilegatura) **Fronte/retro** sta sul lato esterno: a destra nelle pagine dispari, a sinistra nelle pari. In questo caso il primo capitolo comincia sempre su una pagina di destra: se serve, prima c'è una pagina bianca senza numero.
