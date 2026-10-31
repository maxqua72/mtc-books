import { chromium, type Browser, type Page } from 'playwright';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getFontCss } from './pdfFonts.js';

// ---------------------------------------------------------------------------
// Numeri di pagina e indice (invariati rispetto al motore originale)
// ---------------------------------------------------------------------------
// Numeri di pagina in basso al centro; nessun numero sulla copertina
const PAGE_NUMBER_CSS = `
  @page {
    @bottom-center {
      content: counter(page);
      font-family: 'Lora', Georgia, serif;
      font-size: 9pt;
      color: #525252;
    }
  }
  /* Per sicurezza: la pagina con nome "cover" eredita il box, lo azzeriamo */
  @page cover {
    @bottom-center { content: none; }
  }
`;

/** Assegna un id ai titoli, ci mette un marcatore invisibile e rende cliccabili le voci dell'indice */
async function prepareToc(page: Page): Promise<number> {
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
  });
}

/** Legge dal PDF in che pagina (1 = prima pagina) compare il marcatore di ogni titolo */
async function readHeadingPages(pdf: Buffer): Promise<Map<number, number>> {
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

async function fillTocPages(page: Page, pages: Map<number, number>) {
  await page.evaluate((pairs: [number, number][]) => {
    const map = new Map(pairs);
    document.querySelectorAll<HTMLElement>('.toc-entry[data-toc-n]').forEach(li => {
      const el = li.querySelector('.toc-page');
      const p = map.get(Number(li.dataset.tocN));
      if (el) el.textContent = p ? String(p) : '';
    });

    // I marcatori servivano solo alla prima passata: via dal DOM, così non finiscono nel PDF finale
    document.querySelectorAll('.toc-marker').forEach(m => m.remove());
  }, Array.from(pages.entries()));
}

// ---------------------------------------------------------------------------
// Browser condiviso
// ---------------------------------------------------------------------------
let browserPromise: Promise<Browser> | null = null;

/** Un solo Chromium per tutto il processo; richieste concorrenti all'avvio non ne lanciano due */
export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
      .then((browser) => {
        console.log('Motore Chromium per PDF avviato.');
        browser.on('disconnected', () => { browserPromise = null; }); // se Chromium cade, alla richiesta successiva riparte
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

// ---------------------------------------------------------------------------
// Formati pagina
// ---------------------------------------------------------------------------
// Formati non standard del libro (Playwright conosce solo A4, Letter, ...).
// Devono restare allineati a PAGE_FORMATS_MM in src/utils/pageFormats.ts (il client).
const CUSTOM_PAGE_SIZES: Record<string, { width: string; height: string }> = {
  'crown-quarto': { width: '189mm', height: '246mm' },
  'b-format': { width: '129mm', height: '198mm' },
};

function pdfPageOptions(pageSize: string) {
  const custom = CUSTOM_PAGE_SIZES[pageSize.toLowerCase()];
  return custom ? { width: custom.width, height: custom.height } : { format: pageSize as any };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
/** Per ispezionare l'HTML inviato a Chromium: PDF_DEBUG=1 (cartella opzionale in PDF_DEBUG_DIR) */
const DEBUG_HTML = process.env.PDF_DEBUG === '1';

function buildFullDocumentHtml(sectionsHtml: string, customCss: string, fontCss: string): string {
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <style>
        ${fontCss}
        ${customCss}
        ${PAGE_NUMBER_CSS}
      </style>
    </head>
    <body>
      <div class="book-print-container book-text-engine show-numbering">
        ${sectionsHtml}
      </div>
    </body>
    </html>
  `;
}

interface RenderOptions {
  sectionsHtml: string;
  customCss: string;
  pageSize: string;
  debugName: string;
  /** Libro intero: prima passata per scoprire in che pagina cade ogni titolo, poi si scrivono i numeri nell'indice */
  withToc?: boolean;
}

/** Unico percorso di rendering, usato dal capitolo singolo e dal libro intero */
async function renderPdf({ sectionsHtml, customCss, pageSize, debugName, withToc = false }: RenderOptions): Promise<Buffer> {
  const [browser, fontCss] = await Promise.all([getBrowser(), getFontCss()]);
  const fullHtml = buildFullDocumentHtml(sectionsHtml, customCss, fontCss);

  if (DEBUG_HTML) {
    const debugPath = path.resolve(process.env.PDF_DEBUG_DIR || process.cwd(), debugName);
    await writeFile(debugPath, fullHtml, 'utf-8');
    console.log(`[DEBUG] HTML completo salvato in: ${debugPath}`);
  }

  const context = await browser.newContext();
  try {
    const page = await context.newPage();

    // Il contenuto è autosufficiente (font e immagini sono data URI): 'load' basta e
    // evita i 500 ms di attesa di 'networkidle'.
    await page.setContent(fullHtml, { waitUntil: 'load' });

    await page.evaluate(async () => {
      await document.fonts.ready;
      // Le immagini (es. la copertina) devono essere decodificate prima di stampare
      await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => { })));
    });

    const pdfOptions = {
      ...pdfPageOptions(pageSize),
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      displayHeaderFooter: false
    };

    // Indice: prima passata per scoprire le pagine, poi scrittura dei numeri
    if (withToc) {
      const tocEntries = await prepareToc(page);
      if (tocEntries > 0) {
        const firstPass = await page.pdf(pdfOptions);
        const pages = await readHeadingPages(firstPass);
        if (pages.size === 0) console.warn('[PDF ENGINE] Nessun marcatore trovato nel PDF: indice senza numeri.');
        else console.log(`[PDF ENGINE] Indice: trovate ${pages.size} pagine di titoli.`);
        await fillTocPages(page, pages);
      } else {
        await page.evaluate(() => document.querySelectorAll('.toc-marker').forEach(m => m.remove()));
      }
    }

    return await page.pdf(pdfOptions);
  } finally {
    await context.close(); // chiude anche la pagina
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
interface GeneratePdfOptions {
  htmlContent: string;
  customCss: string;
  chapterNumber?: number; // Numero del capitolo (default 1)
  pageSize?: string;
}

/** PDF di un singolo capitolo */
export async function generatePdfFromHtml({
  htmlContent,
  customCss,
  chapterNumber = 1,
  pageSize = 'A4'
}: GeneratePdfOptions): Promise<Buffer> {
  // Avvolge anche il singolo capitolo in <section class="book-section">
  const sectionsHtml = `
      <section class="book-section" style="--chapter-index: ${chapterNumber};">
        ${htmlContent}
      </section>
    `;
  return renderPdf({ sectionsHtml, customCss, pageSize, debugName: 'debug_output.html' });
}

interface SectionItem {
  id: string;
  title: string;
  type: string;
  chapterNumber: number;
  html: string;
}

interface GenerateBookPdfOptions {
  sections: SectionItem[];
  customCss: string;
  bookTitle?: string;
  pageSize?: string;
}

/** PDF dell'intero libro: ogni sezione in un <section class="book-section">, con indice numerato */
export async function generateFullBookPdf({
  sections,
  customCss,
  pageSize = 'A4'
}: GenerateBookPdfOptions): Promise<Buffer> {
  // Mappa tutte le sezioni garantendo il tag <section class="book-section">
  const sectionsHtml = sections
    .map(
      (sec) => `
        <section 
          class="book-section ${sec.type === 'cover' || sec.type === 'index' ? 'is-structural-page' : ''}" 
          data-section-id="${sec.id}" 
          data-section-type="${sec.type}" 
          style="--chapter-index: ${sec.chapterNumber || 1};"
        >
          ${sec.html}
        </section>
      `
    )
    .join('\n');

  return renderPdf({ sectionsHtml, customCss, pageSize, debugName: 'debug_output_book.html', withToc: true });
}