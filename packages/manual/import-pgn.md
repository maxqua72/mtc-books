# Importare un PGN

Il PGN è il formato standard delle partite di scacchi. Per importare servono la modalità di modifica e un capitolo aperto.

## Procedura

Apri la scheda **Importa PGN** nella console.

![La scheda Importa PGN con una partita pronta da importare](/screenshots/import-pgn.png)

1. **Incolla il PGN o carica un file**: incolla il testo, oppure usa **Carica file…** con un file `.pgn` o `.txt`. **Pulisci** svuota il campo.
2. **Partite nel file**: scegli le partite. Per ognuna vedi mosse, varianti e commenti. Le partite senza mosse sono ignorate.
3. **Dove va inserito**: scegli la destinazione.
4. Clicca **Importa nel documento**. L'esito compare in un avviso in basso e la console torna alla scheda **FEN**, con il nuovo albero attivo.

Nella scheda **Importa PGN** non ci sono gli altri comandi della console, come **Inserisci Diagramma**: compaiono nelle altre schede.

## Destinazioni

**Nuovo albero di mosse** crea un blocco per ogni partita, in uno di questi punti. Quando c'è almeno una partita da importare, il punto è segnato nel documento da un riquadro tratteggiato.

- **Dopo l'albero attivo**.
- **Dopo il punto in cui si trova il cursore**.
- **In fondo al capitolo**.

**Aggiungi all'albero attivo** unisce le mosse a quelle già presenti. Se non è possibile, l'opzione spiega il motivo.

Importare molte partite in un capitolo può rallentare l'editor: in quel caso l'app chiede conferma.
