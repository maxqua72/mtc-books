export interface FontFaceDef {
  family: string
  /** Nomi di file accettati, in ordine di preferenza. Il confronto ignora maiuscole/minuscole. */
  files: string[]
  weight: string
  style: 'normal' | 'italic'
  display: 'swap' | 'block'
}

const FONT_FACES: FontFaceDef[] = [
  // EB Garamond (variabile)
  { family: 'EB Garamond', files: ['EBGaramond-VariableFont_wght.ttf'], weight: '400 800', style: 'normal', display: 'swap' },
  { family: 'EB Garamond', files: ['EBGaramond-Italic-VariableFont_wght.ttf'], weight: '400 800', style: 'italic', display: 'swap' },
  // Scacchiera e figurine
  { family: 'Chess Merida', files: ['chess-merida.woff2'], weight: 'normal', style: 'normal', display: 'block' },
  { family: 'Chess Cases', files: ['case.woff2'], weight: 'normal', style: 'normal', display: 'swap' },
  { family: 'Chess The Good Companions', files: ['goodcompanions.woff2'], weight: 'normal', style: 'normal', display: 'swap' },
  // Lora (testo)
  { family: 'Lora', files: ['Lora-Regular.ttf'], weight: '400', style: 'normal', display: 'swap' },
  { family: 'Lora', files: ['Lora-Italic.ttf'], weight: '400', style: 'italic', display: 'swap' },
  { family: 'Lora', files: ['Lora-Bold.ttf'], weight: '700', style: 'normal', display: 'swap' },
  { family: 'Lora', files: ['Lora-BoldItalic.ttf'], weight: '700', style: 'italic', display: 'swap' },
]

export interface FontFormat { mime: string; format: string }

const FONT_FORMATS: Record<string, FontFormat> = {
  '.ttf': { mime: 'font/ttf', format: 'truetype' },
  '.otf': { mime: 'font/otf', format: 'opentype' },
  '.woff': { mime: 'font/woff', format: 'woff' },
  '.woff2': { mime: 'font/woff2', format: 'woff2' },
}

const extOf = (name: string) => {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i).toLowerCase()
}

/**
 * Regole @font-face a partire dall'elenco dei file presenti in una cartella.
 * `srcFor` decide cosa mettere in url(): un data URI (server) o un indirizzo locale (desktop).
 * I font mancanti si segnalano in `missing`; gli altri restano disponibili.
 */
export async function buildFontCss(
  dirEntries: string[],
  srcFor: (fileName: string, format: FontFormat) => string | Promise<string>
): Promise<{ css: string; missing: string[] }> {
  const byLowerName = new Map(dirEntries.map(name => [name.toLowerCase(), name]))
  const missing: string[] = []

  const rules = await Promise.all(
    FONT_FACES.map(async (face) => {
      const found = face.files.map(f => byLowerName.get(f.toLowerCase())).find(Boolean)
      if (!found) {
        missing.push(`${face.family} ${face.weight} ${face.style} (cercato: ${face.files.join(', ')})`)
        return ''
      }
      const fmt = FONT_FORMATS[extOf(found)]
      if (!fmt) {
        missing.push(`${face.family}: estensione non supportata (${found})`)
        return ''
      }
      const src = await srcFor(found, fmt)
      return `
      @font-face {
        font-family: '${face.family}';
        src: url('${src}') format('${fmt.format}');
        font-weight: ${face.weight};
        font-style: ${face.style};
        font-display: ${face.display};
      }`
    })
  )
  return { css: rules.join('\n'), missing }
}