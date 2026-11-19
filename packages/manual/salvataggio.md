# Salvare e aprire

Un libro si salva in un file `.mtcbook`, che contiene testo, alberi, diagrammi e immagini della copertina. Nell'intestazione vedi sempre lo stato del salvataggio.

## Nell'app desktop

Il file è la versione ufficiale del libro; l'app ne tiene anche una copia interna, aggiornata a ogni modifica (**Copia interna aggiornata** nell'intestazione). L'intestazione mostra il nome del file e l'ora dell'ultimo salvataggio; **Nessun file associato** indica che il libro è solo nella copia interna.

- **Salva Lavoro** salva sul file. La prima volta scegli nome e cartella.
- **Salva con nome…**, dalla freccia accanto, apre subito la scelta di nome e cartella e crea un file nuovo.

![Il menu di salvataggio](/screenshots/menu-salva.png)

### Salvataggio automatico

Con un file associato e le modifiche attive, il libro si salva dopo 30 secondi senza modifiche e quando la finestra perde il focus. In sola lettura il file non viene toccato.

Prima di sovrascrivere, l'app conserva la versione precedente in un file `.bak` nella stessa cartella.

### Modifiche esterne

Se un altro programma ha cambiato il file, ad esempio un servizio di sincronizzazione, il salvataggio automatico si sospende. Al salvataggio manuale puoi scegliere **Annulla**, **Sovrascrivi** o **Salva con nome…**.

### Riapertura

Alla riapertura il libro riparte dalla copia interna e si ricollega al suo file. Se il file non si trova, l'app lo segnala e il salvataggio automatico resta spento finché non usi **Salva con nome**.

## Nella versione web

Il browser conserva automaticamente una copia del lavoro: l'intestazione mostra **Salvato nel browser**. **Il file va però scaricato a mano**: **Salva Lavoro** scarica il `.mtcbook`, con un nome ricavato dal titolo del libro. Salvalo spesso, perché la copia del browser può essere cancellata con i dati di navigazione.

Se il file non è aggiornato da qualche minuto, sotto l'intestazione compare un avviso con **Salva Lavoro** e **Più tardi**. Anche chiudendo la scheda con il file non aggiornato il browser chiede conferma.

Se il libro è aperto in due schede, una sola può scrivere: scegli **Usa questa scheda** in quella su cui lavori.

## Aprire e creare

**Apri...** carica un file e **Nuovo**, presente quando un libro è aperto, crea un libro. Entrambi sostituiscono il libro aperto e chiedono conferma se ci sono modifiche non salvate su file.

L'app avvisa anche se stai aprendo una versione più vecchia dello stesso libro. Un file salvato da una versione più recente di MTC Books non si apre: aggiorna l'app.
