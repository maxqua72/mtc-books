# Diagrammi

Un diagramma è una posizione stampata nel testo, con numero e didascalia.

## Inserire un diagramma

Porta la scacchiera sulla posizione e clicca **Inserisci Diagramma** nella console. Passando con il mouse sul pulsante, un riquadro tratteggiato nel testo mostra dove finirà il diagramma. Il punto di inserimento dipende dalla situazione:

| Situazione | Dove finisce |
|---|---|
| Posizione libera | Dopo il paragrafo del cursore |
| Posizione iniziale di un albero con mosse | Prima del blocco |
| Mossa con altro da stampare dopo | Il blocco viene diviso in quel punto |
| Albero vuoto, o nulla da stampare dopo la mossa | Dopo il blocco |

Quando il blocco viene diviso, in basso compare un avviso con **Annulla**: per qualche secondo toglie il diagramma e riunisce il blocco.

Dopo un diagramma il cursore va nella riga vuota sotto. Inserendo subito un altro diagramma, questo prende il posto della riga vuota: i due diagrammi restano di seguito, pronti per formare una fila.

## Comandi del diagramma

Passando sul diagramma compare una barra a destra.

![Un diagramma con la barra dei comandi](/screenshots/diagramma.png)

- **Dimensione**: piccola, media o grande.
- **Allineamento**: al centro, oppure a sinistra o a destra con il testo che scorre accanto. Due diagrammi di seguito, uno a sinistra e uno a destra, formano una fila: il testo che li segue va sotto entrambi. Per scrivere tra due file usa **Inserisci un paragrafo sotto** sul secondo diagramma della prima fila.
- **Affianca al diagramma precedente**: compare quando subito prima c'è un altro diagramma. In un clic forma la fila: il precedente a sinistra, questo a destra, con la stessa dimensione, e toglie l'eventuale riga vuota in mezzo.
- **Modifica didascalia**: porta il cursore alla fine della didascalia; se la didascalia è già attiva, la conferma come `Invio`.
- **Inverti il diagramma**: mette il Nero in basso.
- **Carica la posizione sulla scacchiera**.
- **Inserisci un paragrafo sopra** o **sotto**.
- **Elimina diagramma**.

Le misure reali dipendono dal formato di pagina del libro. Con il [layout a due colonne](./struttura-libro#layout-a-due-colonne) i diagrammi si adattano alla larghezza della colonna e sono sempre centrati, quindi i comandi di allineamento non compaiono. L'allineamento scelto torna valido se riporti il libro a colonna unica.

## Didascalia

Clicca la didascalia per scriverla: mentre il cursore è dentro, ha bordo e sfondo. `Invio` conferma e porta il cursore nel testo dopo il diagramma; `Maiusc+Invio` va a capo. Cliccando altrove la didascalia torna normale. Anche una didascalia vuota si scrive cliccando sotto la scacchiera, dove il passaggio del mouse mostra un bordo leggero.

## Riferimenti nel testo

Il comando **Inserisci un riferimento a un diagramma** nella barra degli strumenti elenca i diagrammi del libro. Il riferimento segue la numerazione anche se i diagrammi cambiano ordine.

`Ctrl`+clic su un riferimento porta al diagramma. Se il diagramma viene eliminato, il riferimento appare come `?`, e l'esportazione del libro lo segnala.
