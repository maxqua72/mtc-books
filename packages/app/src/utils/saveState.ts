// Stato del salvataggio mostrato nell'intestazione: copia interna (IndexedDB) e file .mtcbook in un solo indicatore
import type { SaveStatus } from '../stores/book/types'

export type SaveStateKind = 'busy' | 'local' | 'file' | 'no-file' | 'paused' | 'error'

export interface SaveStateInput {
  status: SaveStatus          // copia interna: 'saved' oppure modifiche in scrittura
  nativeFiles: boolean        // desktop: file associato e salvataggio automatico
  hasFile: boolean
  fileDirty: boolean          // il file .mtcbook non contiene le ultime modifiche
  paused: boolean             // salvataggio automatico sospeso (file cambiato da altri)
  error: boolean              // ultimo salvataggio automatico non riuscito
}

export interface SaveState { kind: SaveStateKind; label: string }

/**
 * Gli avvisi del desktop (sospeso, errore, nessun file) vincono sul salvataggio in corso: durano finché
 * non si interviene e non devono sparire a ogni tasto premuto. Poi conta la scrittura in corso, infine
 * se il file è aggiornato (doppia spunta) o no (spunta).
 */
export function saveState(i: SaveStateInput): SaveState {
  if (i.nativeFiles) {
    if (i.paused) return { kind: 'paused', label: 'Salvataggio sospeso' }
    if (i.error) return { kind: 'error', label: 'Salvataggio non riuscito' }
    if (!i.hasFile) return { kind: 'no-file', label: 'Da salvare su file' }
  }
  if (i.status !== 'saved') return { kind: 'busy', label: 'Salvataggio...' }
  if (!i.fileDirty) return { kind: 'file', label: 'Salvato su file' }
  return { kind: 'local', label: i.nativeFiles ? 'Salvato' : 'Salvato nel browser' }
}

/** Nome del file senza estensione, per l'intestazione e il titolo della finestra */
export const shortFileName = (name: string) => name.replace(/\.mtcbook$/i, '')
