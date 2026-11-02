import { DOWNLOAD_URL } from '@mtc/shared'

/** Nella web app il PDF non si genera: si invita a usare l'app desktop */
export function showPdfDesktopNotice() {
  const open = confirm(
    'L\'esportazione in PDF è disponibile solo nell\'app desktop di MTC Book, che genera il PDF direttamente sul tuo computer.\n\n' +
    'Puoi continuare a scrivere qui e salvare il libro in un file .mtcbook: l\'app desktop lo apre e lo stampa.\n\n' +
    `Pagina di download:\n${DOWNLOAD_URL}\n\nVuoi aprirla ora?`
  )
  if (open) window.open(DOWNLOAD_URL, '_blank', 'noopener,noreferrer')
}