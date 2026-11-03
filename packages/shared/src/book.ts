/**
 * Versione del formato .mtcbook. Si aumenta solo per modifiche che una versione precedente dell'app
 * non saprebbe salvare senza perdere dati; i campi facoltativi nuovi non la cambiano.
 */
export const BOOK_FORMAT_VERSION = 1

/** I file scritti prima dell'introduzione del campo valgono come versione 1 */
export function readFormatVersion(book: unknown): number {
  const v = (book as { formatVersion?: unknown } | null)?.formatVersion
  return Number.isInteger(v) && (v as number) >= 1 ? (v as number) : 1
}

export const isBookTooNew = (book: unknown): boolean => readFormatVersion(book) > BOOK_FORMAT_VERSION

export const BOOK_TOO_NEW_MESSAGE = 'Questo libro è stato salvato con una versione più recente di MTC Book. Aggiorna l\'applicazione per aprirlo.'
