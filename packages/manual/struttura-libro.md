# Struttura e proprietà del libro

Un libro è un elenco di sezioni, visibile nella colonna sinistra. Le sezioni sono di quattro tipi: **copertina**, **indice**, **capitolo** e **sezione senza numero**.

![La colonna sinistra con copertina, capitoli e indice](/screenshots/sezioni.png)

## Gestire le sezioni

| Azione | Come |
|---|---|
| Aprire una sezione | Clic sulla voce |
| Aggiungere un capitolo | **Nuovo Capitolo** |
| Aggiungere copertina o indice | **Copertina** o **Indice** |
| Aggiungere una sezione senza numero | **Altro** → **Sezione prima dei capitoli** o **Sezione dopo i capitoli** |
| Aggiungere una sezione generata | **Altro** → per esempio **Legenda dei simboli**: vedi [Sezioni generate](#sezioni-generate) |
| Riordinare capitoli e sezioni senza numero | Trascina la voce |
| Rinominare | Passa sulla voce e clicca la matita |
| Eliminare | Passa sulla voce e clicca il cestino |

Il libro può avere una sola copertina e un solo indice. L'ordine segue quello dei libri di scacchi: copertina, indice, sezioni senza numero iniziali, capitoli, sezioni senza numero finali. Copertina e indice non si spostano. Un capitolo lasciato sulla copertina o sull'indice diventa il primo capitolo.

Un libro salvato con una versione precedente dell'app, che metteva l'indice in fondo, si apre con l'indice dopo la copertina.

## Sezioni senza numero

Prefazione, introduzione, ringraziamenti, conclusioni, bibliografia: sono sezioni che stanno prima o dopo i capitoli e non hanno numero. Le scrivi come un capitolo, con testo, alberi di mosse e diagrammi, e il nome lo decidi tu: di solito è il primo **Titolo 1**.

| Elemento | Nella sezione senza numero |
|---|---|
| Titoli | Senza numero. Nell'indice compare solo il **Titolo 1**, senza numero |
| Diagrammi | Senza numero; resta il pallino del tratto |
| Capitoli | La numerazione dei capitoli non cambia |

Trascinando una sezione senza numero puoi:

- cambiarne l'ordine rispetto alle altre sezioni dello stesso gruppo;
- spostarla dall'inizio alla fine del libro, o viceversa: lasciala su una sezione dell'altro gruppo, oppure sull'ultimo capitolo (scendendo) o sul primo (salendo);
- portarla prima di tutte le sezioni iniziali, lasciandola sull'indice.

Una sezione senza numero non va mai tra due capitoli.

## Sezioni generate

Dal menu **Altro** puoi aggiungere sezioni che l'app scrive da sola, ricavandole dalle partite e dalle mosse del libro. Sono sezioni senza numero: si spostano come le altre, compaiono nell'indice e nell'editor si leggono ma non si modificano. Si aggiornano da sole quando cambi il libro. Puoi rinominarle con la matita: il nome diventa il titolo della sezione.

| Voce di **Altro** | Contenuto | Dove nasce |
|---|---|---|
| **Legenda dei simboli** | I simboli usati nelle mosse del libro, con il significato: scacco e matto, qualità della mossa, valutazione della posizione, altri simboli | Prima dei capitoli |

Ogni sezione generata può comparire una sola volta nel libro.

::: warning Eliminare una sezione
Dopo la conferma il testo della sezione va perduto.
:::

## Opzioni del capitolo

Il pulsante **Opzioni del capitolo** compare passando sulla voce; per le sezioni senza numero si chiama **Opzioni della sezione**. Contiene:

- **Nome uguale al primo titolo**: il nome nell'elenco segue il primo **Titolo 1** della sezione.
- **Nome del capitolo** (o **Nome della sezione**): modificabile quando il collegamento è disattivato.

Se rinomini dall'elenco una sezione collegata, l'app chiede conferma e disattiva il collegamento.

## Indice

L'indice si genera dai titoli dei capitoli (**Titolo 1**, **Titolo 2**, **Titolo 3**) e dal **Titolo 1** delle sezioni senza numero, senza doverlo scrivere. I numeri di pagina si calcolano durante l'esportazione del libro intero.

![L’indice generato dai titoli](/screenshots/indice.png)

## Proprietà del libro

Clicca l'icona **Proprietà Libro** accanto al titolo, nella colonna sinistra.

![La finestra Proprietà del Libro](/screenshots/proprieta-libro.png)

| Proprietà | Effetto |
|---|---|
| Titolo del Libro, Autore | Dati del libro |
| Formato di Stampa | A4 (210 x 297 mm), Crown Quarto (189 x 246 mm), B-Format (129 x 198 mm) |
| Rilegatura | Lascia 10 mm in più sul lato da rilegare: vedi [Rilegatura](#rilegatura) |
| Spaziatura | Distanza in mm tra paragrafi, intorno ai diagrammi e intorno alle varianti, da 0 a 30 |
| Mostra numerazione automatica | Aggiunge i prefissi 1., 1.1 ai titoli nell'editor e nell'indice |
| Layout a due colonne | Dispone il testo dei capitoli in due colonne affiancate: vedi [Layout a due colonne](#layout-a-due-colonne) |

La spaziatura vale per tutto il libro, nell'editor e nel PDF. In sola lettura le proprietà non si possono cambiare.

## Rilegatura

Se rileghi il libro stampato, con una spirale, degli anelli o dei punti metallici, scegli **Rilegatura** nella finestra **Proprietà del Libro**. Lo spazio in più fa sì che i fori o la piega non tocchino il testo.

| Voce | Effetto |
|---|---|
| **Nessuna** | Margini normali su tutte le pagine |
| **A sinistra (solo fronte)** | 10 mm in più sul margine sinistro di ogni pagina. Per stampare su una sola facciata |
| **Fronte/retro** | 10 mm in più sul margine interno: a sinistra nelle pagine dispari, a destra nelle pari. Per stampare su entrambe le facciate. Il numero di pagina va sul lato esterno: vedi [Numeri di pagina](./esportazione-pdf#numeri-di-pagina) |

Il testo diventa più stretto di 10 mm, quindi il libro può avere qualche pagina in più. Con il [layout a due colonne](#layout-a-due-colonne) ogni colonna si restringe di 5 mm e i diagrammi si adattano.

Nell'editor una fascia tratteggiata chiara sul bordo sinistro del foglio indica lo spazio per la rilegatura; passaci sopra per vederne la misura. La fascia non compare nel PDF, dove resta solo lo spazio bianco. L'editor non è diviso in pagine: con **Fronte/retro** la fascia sta sempre a sinistra, e l'alternanza tra pagine pari e dispari si vede nel PDF.

La copertina resta a pagina piena, senza margini: se la rileghi, tieni lontani dal bordo sinistro testi e immagini importanti.

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
