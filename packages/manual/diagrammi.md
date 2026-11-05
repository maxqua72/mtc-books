# Diagrammi

Un diagramma è una posizione stampata nel testo, con numero e didascalia.

## Inserire un diagramma

Porta la scacchiera sulla posizione e clicca **Inserisci Diagramma** nella console. Il punto di inserimento dipende dalla situazione:

| Situazione | Dove finisce |
|---|---|
| Posizione libera | Dopo il paragrafo del cursore |
| Posizione iniziale di un albero con mosse | Prima del blocco |
| Mossa con altro da stampare dopo | Il blocco viene diviso in quel punto, dopo conferma |
| Albero vuoto, o nulla da stampare dopo la mossa | Dopo il blocco |

## Comandi del diagramma

Passando sul diagramma compare una barra a destra.

![Un diagramma con la barra dei comandi](/screenshots/diagramma.png)

- **Dimensione**: piccola, media o grande.
- **Allineamento**: al centro, oppure a sinistra o a destra con il testo che scorre accanto.
- **Modifica didascalia**: `Invio` conferma, `Maiusc+Invio` va a capo.
- **Inverti il diagramma**: mette il Nero in basso.
- **Carica la posizione sulla scacchiera**.
- **Inserisci un paragrafo sopra** o **sotto**.
- **Elimina diagramma**.

Le misure reali dipendono dal formato di pagina del libro. Con il [layout a due colonne](./struttura-libro#layout-a-due-colonne) i diagrammi si adattano alla larghezza della colonna e sono sempre centrati, quindi i comandi di allineamento non compaiono. L'allineamento scelto torna valido se riporti il libro a colonna unica.

## Riferimenti nel testo

Il comando **Inserisci un riferimento a un diagramma** nella barra degli strumenti elenca i diagrammi del libro. Il riferimento segue la numerazione anche se i diagrammi cambiano ordine.

`Ctrl`+clic su un riferimento porta al diagramma. Se il diagramma viene eliminato, il riferimento appare come `?`, e l'esportazione del libro lo segnala.
