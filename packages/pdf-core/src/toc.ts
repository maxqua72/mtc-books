import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PdfPage } from './types.js'

/** Assegna un id ai titoli, ci mette un marcatore invisibile e rende cliccabili le voci dell'indice */
export async function prepareToc(page: PdfPage): Promise<number> {
  return page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll<HTMLElement>(
      'section[data-section-type="chapter"] [data-toc-level="1"], ' +
      'section[data-section-type="chapter"] [data-toc-level="2"]'
    ));

    headings.forEach((h, i) => {
      h.id = `toc-h-${i}`;
      // Marcatore invisibile (bianco, minuscolo, fuori flusso): serve solo a trovare la pagina nel PDF
      const mk = document.createElement('span');
      mk.className = 'toc-marker';
      mk.textContent = `[[TOC${i}]]`;
      mk.style.cssText = 'position:absolute;font-size:2px;line-height:1;color:#ffffff;';
      h.prepend(mk);
    });

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

/** Legge dal PDF in che pagina (1 = prima pagina) compare il marcatore di ogni titolo */
export async function readHeadingPages(pdf: Uint8Array): Promise<Map<number, number>> {
  // ← incolla qui IDENTICO il corpo di readHeadingPages
  //   l'unica riga che cambia è:  getDocument({ data: new Uint8Array(pdf), verbosity: 0 })
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdf), verbosity: 0 });
    try {
      const doc = await loadingTask.promise;
      const result = new Map<number, number>();
  
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        // Il marcatore può essere spezzato in più frammenti: si unisce tutto e si tolgono gli spazi
        const text = content.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join('')
          .replace(/\s+/g, '');
  
        for (const m of text.matchAll(/\[\[TOC(\d+)\]\]/g)) {
          const n = Number(m[1]);
          if (!result.has(n)) result.set(n, p);
        }
        page.cleanup();
      }
      return result;
    } finally {
      await loadingTask.destroy();
    }
}

export async function fillTocPages(page: PdfPage, pages: Map<number, number>) {
  await page.evaluate((pairs: [number, number][]) => {
    const map = new Map(pairs);
    document.querySelectorAll<HTMLElement>('.toc-entry[data-toc-n]').forEach(li => {
      const el = li.querySelector('.toc-page');
      const p = map.get(Number(li.dataset.tocN));
      if (el) el.textContent = p ? String(p) : '';
    });

    // I marcatori servivano solo alla prima passata: via dal DOM, così non finiscono nel PDF finale
    document.querySelectorAll('.toc-marker').forEach(m => m.remove());
  }, Array.from(pages.entries()))
}