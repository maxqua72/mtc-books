import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Font incorporati nel PDF come data URI Base64 (Chromium non li carica dal disco del server).
 * Il risultato si calcola UNA volta e si riusa: prima i ~9 file venivano riletti e ricodificati a ogni richiesta.
 */

interface FontFaceDef {
  family: string;
  /** Nomi di file accettati, in ordine di preferenza. Il confronto ignora maiuscole/minuscole. */
  files: string[];
  weight: string;
  style: 'normal' | 'italic';
  display: 'swap' | 'block';
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
  { family: 'Lora', files: ['Lora-BoldItalic.ttf', 'lora-bold-italic.ttf'], weight: '700', style: 'italic', display: 'swap' },
];

const FORMATS: Record<string, { mime: string; format: string }> = {
  '.ttf': { mime: 'font/ttf', format: 'truetype' },
  '.otf': { mime: 'font/otf', format: 'opentype' },
  '.woff': { mime: 'font/woff', format: 'woff' },
  '.woff2': { mime: 'font/woff2', format: 'woff2' },
};

const fontsDir = () => process.env.PDF_FONTS_DIR || path.resolve(process.cwd(), 'assets/fonts');

async function loadFontCss(dir: string): Promise<{ css: string; missing: string[] }> {
  const entries = await fs.readdir(dir);
  const byLowerName = new Map(entries.map(name => [name.toLowerCase(), name]));
  const missing: string[] = [];

  const rules = await Promise.all(
    FONT_FACES.map(async (face) => {
      const found = face.files.map(f => byLowerName.get(f.toLowerCase())).find(Boolean);
      if (!found) {
        missing.push(`${face.family} ${face.weight} ${face.style} (cercato: ${face.files.join(', ')})`);
        return '';
      }
      const fmt = FORMATS[path.extname(found).toLowerCase()];
      if (!fmt) {
        missing.push(`${face.family}: estensione non supportata (${found})`);
        return '';
      }
      const base64 = (await fs.readFile(path.join(dir, found))).toString('base64');
      return `
      @font-face {
        font-family: '${face.family}';
        src: url('data:${fmt.mime};base64,${base64}') format('${fmt.format}');
        font-weight: ${face.weight};
        font-style: ${face.style};
        font-display: ${face.display};
      }`;
    })
  );

  return { css: rules.join('\n'), missing };
}

let cache: Promise<string> | null = null;

/**
 * Regole @font-face per Chromium. Un font mancante viene segnalato nel log e gli altri restano disponibili;
 * in quel caso il risultato non si memorizza, così rimettendo il file al suo posto basta la richiesta successiva.
 */
export function getFontCss(): Promise<string> {
  if (!cache) {
    const dir = fontsDir();
    cache = loadFontCss(dir)
      .then(({ css, missing }) => {
        if (missing.length) {
          console.error(`[PDF FONTS] Font non trovati in ${dir}:\n - ${missing.join('\n - ')}`);
          cache = null;
        }
        return css;
      })
      .catch((err) => {
        console.error(`[PDF FONTS] Impossibile leggere la cartella dei font (${dir}):`, err);
        cache = null;
        return '';
      });
  }
  return cache;
}