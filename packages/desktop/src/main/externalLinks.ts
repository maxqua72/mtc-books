import { shell } from 'electron'

const SAFE_EXTERNAL = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export const openExternalSafe = (url: string) => {
    try {
        if (SAFE_EXTERNAL.has(new URL(url).protocol)) void shell.openExternal(url)
    } catch { /* URL non valido: ignorata */ }
}
