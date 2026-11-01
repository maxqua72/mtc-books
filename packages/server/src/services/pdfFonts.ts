import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildFontCss } from '@mtc/pdf-core';

/** Font incorporati nel PDF come data URI Base64. Il risultato si calcola UNA volta e si riusa. */
const fontsDir = () => process.env.PDF_FONTS_DIR || path.resolve(process.cwd(), '../app/src/assets/fonts');

async function loadFontCss(dir: string) {
  const entries = await fs.readdir(dir);
  return buildFontCss(entries, async (file, fmt) => {
    const base64 = (await fs.readFile(path.join(dir, file))).toString('base64');
    return `data:${fmt.mime};base64,${base64}`;
  });
}

let cache: Promise<string> | null = null;

/** Un font mancante viene segnalato nel log e non si memorizza il risultato: rimettendo il file basta la richiesta successiva. */
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