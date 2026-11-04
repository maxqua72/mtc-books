# Introduzione

MTC Book Writer serve a scrivere libri di scacchi: testo, diagrammi e partite commentate stanno nello stesso documento, che alla fine si esporta in PDF pronto per la lettura o la stampa.

## Cosa puoi fare

- Organizzare il libro in **copertina**, **capitoli** e **indice** generato in automatico.
- Scrivere il testo con titoli, elenchi, colori, link e rientri.
- Registrare partite e varianti come **alberi di mosse**, muovendo i pezzi sulla scacchiera.
- Inserire **diagrammi** con didascalia, numerazione e riferimenti nel testo.
- Importare partite da file o testo **PGN**.
- Analizzare le posizioni con un **motore UCI** come Stockfish (solo app desktop).
- Esportare un capitolo o il libro intero in **PDF** (solo app desktop).

## App desktop e versione web

Esistono due versioni con la stessa interfaccia. L'app desktop è l'editor completo; la versione web serve a scrivere dal browser. Il ponte tra le due è il file `.mtcbook`.

| Funzione | App desktop | Versione web |
|---|---|---|
| Scrivere e organizzare il libro | Sì | Sì |
| Scacchiera, alberi, diagrammi, import PGN | Sì | Sì |
| Salvataggio | Sul file, anche automatico | Download del file `.mtcbook` |
| Esportazione PDF | Sì | No |
| Motore di analisi | Sì | No |
| Scelta delle lingue del controllo ortografico | Sì | Usa quelle del browser |

## L'area di lavoro

Con un libro aperto la finestra ha un'intestazione e tre colonne.

- **Intestazione**: versione, stato del salvataggio, nome del file e comandi **Nuovo**, **Apri...**, impostazioni, manuale, sola lettura, esportazione e salvataggio.
- **Colonna sinistra**: titolo del libro ed elenco delle sezioni.
- **Colonna centrale**: la barra degli strumenti e il foglio su cui scrivi.
- **Colonna destra**: la scacchiera, i comandi di navigazione e la console.

Prosegui con [Primi passi](./primi-passi).
