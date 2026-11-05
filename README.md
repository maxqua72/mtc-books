# MTC Book Writer

Editor per scrivere libri di scacchi. Monorepo pnpm: `app` (Vue), `shared`, `pdf-core`, `desktop` (Electron), `server` (opzionale).

Comandi per PowerShell, da eseguire nella cartella principale del progetto.

## Prima installazione

| Comando | Cosa fa |
|---|---|
| `corepack enable` | Attiva pnpm alla versione del progetto (Node 22.12 o successivo) |
| `pnpm install` | Installa le dipendenze |

## Sviluppo

| Attività | Comando | Note |
|---|---|---|
| Web app | `pnpm dev:app` | Vite su `localhost:5174` |
| Desktop | `pnpm dev:app`, poi in un secondo terminale `pnpm dev:desktop` | Serve Vite già avviato; aggiornamento a caldo |
| Server PDF (opzionale) | `pnpm dev:server` | Non serve al prodotto |

## Manuale utente

I testi sono file Markdown in `packages/manual`; il menu laterale è in `packages/manual/.vitepress/config.ts`.

| Attività | Comando | Note |
|---|---|---|
| Anteprima con aggiornamento a caldo | `pnpm dev:manual` | Su `localhost:5175/manual/`; con `pnpm dev:app` è raggiungibile anche dal pulsante «?» |
| Controllo | `pnpm --filter @mtc/manual docs:build` | Fallisce se un link interno è rotto |

Gli screenshot in `packages/manual/public/screenshots` sono file versionati: build e installer usano quelli presenti e **non li rigenerano**. Vanno rigenerati con un comando separato quando cambia l'aspetto di una schermata, in uno di questi due modi:

- **Da GitHub** (consigliato): **Actions → Screenshot del manuale → Run workflow**, scegliendo il branch. Avvia la vera app con un libro di esempio e fa il commit delle immagini sul branch. L'azione compare dopo l'unione in `main`.
- **Dal PC**: i comandi sotto, poi `git add` e commit delle immagini. Serve Stockfish nel `PATH`, altrimenti lo screenshot del motore non viene aggiornato e il comando termina con errore.

```powershell
pnpm --filter @mtc/app build
cd packages\desktop; node scripts/copy-assets.mjs; pnpm exec tsup; cd ..\..
pnpm --filter @mtc/manual screenshots
```

Il libro di esempio e le schermate fotografate sono definiti in `packages/manual/scripts/capture.mjs`.

`pnpm --filter @mtc/app build` genera il manuale in `packages/app/dist/manual`, quindi web e installer lo includono da soli.
Quando una modifica cambia ciò che l'utente vede, aggiorna anche la pagina del manuale nello stesso commit.

## Prova della build compilata

| Attività | Comando | Note |
|---|---|---|
| App desktop come se fosse installata | `pnpm --filter @mtc/desktop start` | Compila l'app e carica `app://mtc`: alcuni difetti compaiono solo qui |
| Build della web app | `pnpm --filter @mtc/app build` | Risultato in `packages/app/dist`, da servire come sito statico |

## Verifica prima del commit

```powershell
pnpm check:boundaries   # regole di dipendenza tra i pacchetti
pnpm typecheck          # controllo dei tipi
pnpm test               # test automatici
pnpm build              # build di tutti i pacchetti
```

## Commit e push

```powershell
git status              # controlla i file coinvolti
git add -A
git commit -m "Descrizione della modifica"
git push origin main
```

Il push avvia la CI ma non pubblica nulla: il rilascio parte solo con un tag `v*`.

## Installazione di prova (senza pubblicare)

| Attività | Come |
|---|---|
| Creare l'installer | `pnpm dist:desktop`: crea `packages\desktop\release\MTC-Book-Setup-<versione>.exe` |
| Installare | Esegui il file; se compare SmartScreen: **Ulteriori informazioni** → **Esegui comunque** |
| Disinstallare | **Impostazioni → App → App installate → MTC Book → Disinstalla** |
| Ripartire da zero | Dopo la disinstallazione cancella `%APPDATA%\MTC Book` (libro di lavoro e profili motore) |

L'app installata e `start` condividono i dati in `%APPDATA%\MTC Book`.

## Rilascio di una versione

```powershell
node scripts/set-version.mjs 1.1.0   # aggiorna la versione nei due package.json
git add -A
git commit -m "Versione 1.1.0"
git tag v1.1.0
git push origin main --tags
```

Il tag avvia `release.yml`, che esegue le verifiche e crea una **bozza** in `mtc-books-releases`. Serve il segreto `RELEASES_TOKEN`.

Per renderla disponibile, apri la bozza su GitHub e pubblicala: solo da quel momento gli utenti ricevono l'aggiornamento.

## Installazione per l'utente finale

1. Scarica `MTC-Book-Setup-<versione>.exe` da <https://github.com/maxqua72/mtc-books-releases/releases/latest>.
2. Esegui il file. L'app non è firmata: su SmartScreen scegli **Ulteriori informazioni** → **Esegui comunque**.
3. Per il motore, scarica Stockfish da <https://stockfishchess.org/download/> e indicalo nel pannello **Motore**: non è incluso nell'app.

Gli aggiornamenti arrivano da soli; la verifica manuale è in **Aiuto → Verifica aggiornamenti…**. Per disinstallare: **Impostazioni → App → App installate**. I file `.mtcbook` restano dove sono.
