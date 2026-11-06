# Esportare in PDF

::: info Solo app desktop
Dalla versione web, salva il file `.mtcbook` e aprilo con l'app desktop.
:::

## Scegliere cosa esportare

Il pulsante di esportazione in alto esegue l'ultima scelta; la freccia accanto la cambia.

![Il menu di esportazione](/screenshots/menu-esporta.png)

- **Esporta Capitolo (PDF)**: esporta la sezione aperta.
- **Esporta Libro (PDF)**: esporta tutte le sezioni nell'ordine dell'elenco.

Con la copertina aperta, **Esporta Capitolo** produce solo la copertina. L'indice si esporta solo con il libro intero, perché i numeri di pagina si calcolano lì.

## Prima di esportare

- Scegli formato e spaziatura nelle [proprietà del libro](./struttura-libro#proprieta-del-libro).
- Se esistono riferimenti a diagrammi eliminati, l'app lo segnala e chiede se continuare.

Durante l'esportazione del libro vedi quale sezione è in lavorazione.

## Misure del PDF

Il PDF ha le misure del **Formato di Stampa** scelto. In A4, Crown Quarto e B-Format il testo è a 11 pt e i margini sono quelli del libro; i diagrammi hanno la misura prevista per il formato.

::: warning Libri già esportati in Crown Quarto o B-Format
Le versioni precedenti dell'app riducevano il contenuto per farlo stare nel foglio. Se esporti di nuovo uno di questi libri, il testo è più grande e le pagine aumentano: a parità di contenuto, circa un terzo in più in Crown Quarto e poco più del doppio in B-Format. Ricontrolla l'impaginazione e l'indice. I PDF in A4 non cambiano.
:::

Il tema dell'interfaccia non cambia il PDF: il foglio è sempre stampato su fondo bianco.
