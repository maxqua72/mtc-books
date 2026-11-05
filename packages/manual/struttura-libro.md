# Struttura e proprietà del libro

Un libro è un elenco di sezioni, visibile nella colonna sinistra. Le sezioni sono di tre tipi: **capitolo**, **copertina** e **indice**.

![La colonna sinistra con copertina, capitoli e indice](/screenshots/sezioni.png)

## Gestire le sezioni

| Azione | Come |
|---|---|
| Aprire una sezione | Clic sulla voce |
| Aggiungere un capitolo | **Nuovo Capitolo** |
| Aggiungere copertina o indice | **Copertina** o **Indice** |
| Riordinare i capitoli | Trascina la voce |
| Rinominare | Passa sulla voce e clicca la matita |
| Eliminare | Passa sulla voce e clicca il cestino |

Il libro può avere una sola copertina e un solo indice. Si possono trascinare solo i capitoli, e non sopra la copertina.

::: warning Eliminare una sezione
Dopo la conferma il testo della sezione va perduto.
:::

## Opzioni del capitolo

Il pulsante **Opzioni del capitolo** compare passando sulla voce. Contiene:

- **Nome uguale al primo titolo**: il nome nell'elenco segue il primo **Titolo 1** del capitolo.
- **Nome del capitolo**: modificabile quando il collegamento è disattivato.

Se rinomini dall'elenco un capitolo collegato, l'app chiede conferma e disattiva il collegamento.

## Indice

L'indice si genera dai titoli dei capitoli (**Titolo 1**, **Titolo 2**, **Titolo 3**), senza doverlo scrivere. I numeri di pagina si calcolano durante l'esportazione del libro intero.

![L’indice generato dai titoli](/screenshots/indice.png)

## Proprietà del libro

Clicca l'icona **Proprietà Libro** accanto al titolo, nella colonna sinistra.

![La finestra Proprietà del Libro](/screenshots/proprieta-libro.png)

| Proprietà | Effetto |
|---|---|
| Titolo del Libro, Autore | Dati del libro |
| Formato di Stampa | A4 (210 x 297 mm), Crown Quarto (189 x 246 mm), B-Format (129 x 198 mm) |
| Spaziatura | Distanza in mm tra paragrafi, intorno ai diagrammi e intorno alle varianti, da 0 a 30 |
| Mostra numerazione automatica | Aggiunge i prefissi 1., 1.1 ai titoli nell'editor e nell'indice |
| Layout a due colonne | Dispone il testo dei capitoli in due colonne affiancate: vedi [Layout a due colonne](#layout-a-due-colonne) |

La spaziatura vale per tutto il libro, nell'editor e nel PDF. In sola lettura le proprietà non si possono cambiare.

## Layout a due colonne

Attiva **Layout a due colonne** nella finestra **Proprietà del Libro**. Il layout vale per tutti i capitoli, nell'editor e nel PDF. Copertina e indice restano a colonna unica.

| Elemento | Comportamento a due colonne |
|---|---|
| **Titolo 1** | Attraversa entrambe le colonne |
| **Titolo 2**, **Titolo 3** | Restano nella colonna e non si fermano da soli in fondo a una colonna |
| Diagrammi | Si adattano alla larghezza della colonna, sono sempre centrati e non si spezzano |
| Partite e varianti | Se sono lunghe proseguono nella colonna o nella pagina successiva |
| Indice | I numeri di pagina tengono conto delle colonne |

### Editor e PDF

Le colonne hanno la stessa larghezza nell'editor e nel PDF, ma l'editor è un foglio continuo, non diviso in pagine. Nell'editor le colonne si bilanciano tra un **Titolo 1** e il successivo, e il punto in cui il testo passa alla colonna accanto può spostarsi mentre scrivi. Per vedere la disposizione definitiva nelle pagine, esporta il PDF.

### B-Format

Con B-Format il layout non è disponibile perché le colonne sarebbero troppo strette: la casella è disattivata e il libro resta a colonna unica. Se l'opzione era attiva, torna da sola quando scegli A4 o Crown Quarto.
