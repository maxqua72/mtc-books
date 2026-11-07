
import type { PdfPage } from './types.js'

/**
 * Assegna un id ai titoli, ci mette un marcatore invisibile e rende cliccabili le voci dell'indice.
 * data-toc-n di una voce è la posizione del titolo in questo elenco: useGeneratedToc dell'app deve contare
 * gli stessi titoli nello stesso ordine.
 * Due marcatori in più segnano l'inizio delle pagine iniziali ([[FRONT]]) e del corpo del libro ([[BODY]]):
 * servono a tradurre la posizione di una pagina nel numero stampato.
 */
export async function prepareToc(page: PdfPage): Promise<number> {
  return page.evaluate(() => {
    // Marcatore invisibile (bianco, minuscolo, largo zero): serve solo a trovare la pagina nel PDF.
    // Sta in linea, dentro un blocco che ha già del testo: da solo aggiungerebbe una riga e sposterebbe le pagine.
    const marker = (text: string) => {
      const mk = document.createElement('span');
      mk.className = 'toc-marker';
      mk.textContent = text;
      mk.style.cssText = 'display:inline-block;width:0;height:0;white-space:nowrap;font-size:2px;line-height:0;color:#ffffff;';
      return mk;
    };

    const headings = Array.from(document.querySelectorAll<HTMLElement>(
      'section[data-section-type] [data-toc-level="1"], ' +
      'section[data-section-type="chapter"] [data-toc-level="2"], ' +
      'section[data-section-type="chapter"] [data-toc-level="3"]'
    ));

    headings.forEach((h, i) => {
      h.id = `toc-h-${i}`;
      h.prepend(marker(`[[TOC${i}]]`));
    });

    for (const [cls, text] of [['front-matter', '[[FRONT]]'], ['body-matter', '[[BODY]]']]) {
      const first = document.querySelector(`section.${cls}`)
        ?.querySelector<HTMLElement>('h1, h2, h3, h4, p, li, .tph-main, .chess-move-item, .diagram-caption');
      first?.prepend(marker(text));
    }

    const entries = Array.from(document.querySelectorAll<HTMLElement>('.toc-entry[data-toc-n]'));
    if (entries.length !== headings.length) {
      console.warn(`Indice: ${entries.length} voci, ${headings.length} titoli`);
    }
    entries.forEach(li => {
      const n = Number(li.dataset.tocN);
      if (!headings[n]) return;
      const a = document.createElement('a');
      a.href = `#toc-h-${n}`;
      a.style.cssText = 'display:flex;flex:1;align-items:baseline;gap:6px;color:inherit;text-decoration:none;';
      while (li.firstChild) a.appendChild(li.firstChild);
      li.appendChild(a);
    });
    return entries.length;
  })
}

const compact = (raw: string) => raw.replace(/\s+/g, '')

/** Da testo per pagina a "titolo n → pagina" (1 = prima). Il marcatore può essere spezzato in frammenti: si tolgono gli spazi. */
export function findHeadingPages(pageTexts: string[]): Map<number, number> {
  const result = new Map<number, number>()
  pageTexts.forEach((raw, i) => {
    for (const m of compact(raw).matchAll(/\[\[TOC(\d+)\]\]/g)) {
      const n = Number(m[1])
      if (!result.has(n)) result.set(n, i + 1)
    }
  })
  return result
}

const ROMAN: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]

export const toRoman = (n: number): string => {
  let out = ''
  for (const [value, digits] of ROMAN) while (n >= value) { out += digits; n -= value }
  return out
}

/** Numero stampato su una pagina (1 = prima del PDF): romano nelle pagine iniziali, arabo da 1 nel corpo */
export function pageLabeler(pageTexts: string[]): (page: number) => string {
  const startOf = (tag: string) => {
    const i = pageTexts.findIndex((t) => compact(t).includes(tag))
    return i === -1 ? null : i + 1
  }
  const front = startOf('[[FRONT]]')
  const body = startOf('[[BODY]]')
  return (page) => {
    if (body !== null && page >= body) return String(page - body + 1)
    if (front !== null && page >= front) return toRoman(page - front + 1)
    return String(page)
  }
}

export async function fillTocPages(page: PdfPage, pages: Map<number, string>) {
  await page.evaluate((pairs: [number, string][]) => {
    const map = new Map(pairs);
    document.querySelectorAll<HTMLElement>('.toc-entry[data-toc-n]').forEach(li => {
      const el = li.querySelector('.toc-page');
      const p = map.get(Number(li.dataset.tocN));
      if (el) el.textContent = p ?? '';
    });

    // I marcatori servivano solo alla prima passata: via dal DOM, così non finiscono nel PDF finale
    document.querySelectorAll('.toc-marker').forEach(m => m.remove());
  }, Array.from(pages.entries()))
}
