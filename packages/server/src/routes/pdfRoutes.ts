import { Router, Request, Response } from 'express';
import { generatePdfFromHtml, generateFullBookPdf } from '../services/pdfEngine.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const pdfRouter = Router();

// Solo con PDF_CAPTURE_DIR impostata: salva il corpo di ogni richiesta, per i test di regressione
const CAPTURE_DIR = process.env.PDF_CAPTURE_DIR;
if (CAPTURE_DIR) {
  pdfRouter.use(async (req, _res, next) => {
    if (req.method === 'POST') {
      try {
        await mkdir(CAPTURE_DIR, { recursive: true });
        const name = `${Date.now()}_${req.path.replace(/\W+/g, '_')}.json`;
        await writeFile(path.join(CAPTURE_DIR, name), JSON.stringify(req.body));
        console.log(`[CAPTURE] ${name}`);
      } catch (e) {
        console.error('[CAPTURE] errore:', e);
      }
    }
    next();
  });
}

/**
 * Header Content-Disposition valido anche con titoli come "Capitolo 1 — Introduzione":
 * Node rifiuta i caratteri fuori da latin1 nell'header, quindi nome ASCII di ripiego + filename* (RFC 5987).
 */
function attachmentHeader(filename: string): string {
  const ascii = filename.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

pdfRouter.post('/pdf/generate',async (req: Request, res: Response) => {
  try {
    const { htmlContent, customCss, chapterNumber, pageSize, outerPageNumbers } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'Il campo htmlContent è obbligatorio.' });
    }

    console.log(`Generazione PDF per il capitolo ${chapterNumber} con pageSize: ${pageSize || 'A4'}`);

    const pdfBuffer = await generatePdfFromHtml({
      htmlContent,
      customCss: customCss || '',
      chapterNumber: typeof chapterNumber === 'number' ? chapterNumber : 1,
      pageSize: pageSize || 'A4',
      outerPageNumbers: outerPageNumbers === true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', attachmentHeader('capitolo.pdf'));
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Errore durante la generazione del capitolo PDF:', error);
    return res.status(500).json({ error: 'Errore interno durante la generazione del capitolo PDF.' });
  }
});

pdfRouter.post('/pdf/generate-book',async (req: Request, res: Response) => {
  try {
    const { sections, customCss, bookTitle, pageSize, outerPageNumbers } = req.body;

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ error: 'L\'array delle sezioni è obbligatorio e non può essere vuoto.' });
    }

    const pdfBuffer = await generateFullBookPdf({
      sections,
      customCss: customCss || '',
      bookTitle,
      pageSize: pageSize || 'A4',
      outerPageNumbers: outerPageNumbers === true
    });

    const filename = bookTitle ? `${String(bookTitle).toLowerCase().replace(/\s+/g, '_')}_completo.pdf` : 'libro_completo.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', attachmentHeader(filename));
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Errore durante la generazione del libro completo PDF:', error);
    return res.status(500).json({ error: 'Errore interno durante la generazione del libro completo PDF.' });
  }
});