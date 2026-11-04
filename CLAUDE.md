# Istruzioni per il progetto

- Il manuale utente è in `packages/manual` (Markdown, VitePress). Quando una modifica cambia ciò che l'utente vede o fa, aggiorna la pagina del manuale nello stesso commit, usando le etichette esatte dell'interfaccia.
- Se una modifica cambia l'aspetto di una schermata, aggiorna `packages/manual/scripts/capture.mjs` se serve e segnala di rigenerare gli screenshot.
- Nel manuale non descrivere dettagli tecnici e segnala con un riquadro `::: info` le funzioni solo desktop.
- Prima del commit esegui i comandi elencati nel README, sezione «Verifica prima del commit».
