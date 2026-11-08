// Rigenera i PDF del libro di esempio dalla matrice esempi/dall-apertura-al-finale.mtcbook,
// esportandoli con la vera app desktop: colonna unica, fronte/retro e due colonne.
// Avvio: pnpm libro-esempio (dalla radice: fa anche la build). I PDF finiscono in esempi/pdf, ignorata da git.
// L'app apre una copia temporanea della matrice e non salva mai: il file versionato non cambia.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const desktopDir = path.join(root, 'packages/desktop')
const matrix = path.join(root, 'esempi/dall-apertura-al-finale.mtcbook')
const outDir = path.join(root, 'esempi/pdf')
const work = mkdtempSync(path.join(tmpdir(), 'mtc-esempio-'))
const userData = path.join(work, 'dati')
const copy = path.join(work, path.basename(matrix))
mkdirSync(outDir, { recursive: true })
copyFileSync(matrix, copy)

// Le tre versioni: nome del PDF e opzioni di Proprietà del Libro, applicate solo per l'esportazione
const VERSIONS = [
  { file: 'dall-apertura-al-finale.pdf', binding: 'none', twoColumns: false },
  { file: 'dall-apertura-al-finale-fronte-retro.pdf', binding: 'duplex', twoColumns: false },
  { file: 'dall-apertura-al-finale-due-colonne.pdf', binding: 'none', twoColumns: true },
]

const app = await electron.launch({
  executablePath: createRequire(path.join(desktopDir, 'package.json'))('electron'),
  args: ['.', '--dist', '--no-sandbox', `--user-data-dir=${userData}`],
  cwd: desktopDir,
})

let page
try {
  page = await app.firstWindow()
  page.on('dialog', (d) => { void d.accept().catch(() => {}) })
  await page.waitForLoadState('domcontentloaded')
  const settle = (ms = 300) => page.waitForTimeout(ms)

  // Apertura dalla schermata iniziale: il libro non ha un file associato, quindi l'app non lo salva da sola
  await page.getByRole('button', { name: 'Crea un nuovo libro' }).waitFor()
  await settle(400)
  const chooser = page.waitForEvent('filechooser')
  await page.getByText('Trascina qui il tuo file .mtcbook').click()
  await (await chooser).setFiles(copy)
  await page.locator('aside').first().getByText('Indice Generale').waitFor({ timeout: 20000 })
  await settle(800)
  // Un libro aperto da file è in sola lettura: per cambiare le proprietà va sbloccato
  await page.getByRole('switch').first().click()
  await settle(300)

  // Esportazione del libro intero: la scelta del menu resta per le esportazioni successive
  await page.locator('header [aria-haspopup="true"]').first().click()
  await settle(150)
  await page.getByRole('button', { name: 'Esporta Libro (PDF)' }).first().click()
  await settle(150)

  const columns = page.getByRole('checkbox', { name: /Layout a due colonne/ })
  for (const v of VERSIONS) {
    await page.getByRole('button', { name: /Proprietà Libro/ }).click()
    await settle(300)
    await page.locator('#book-binding').selectOption(v.binding)
    if ((await columns.isChecked()) !== v.twoColumns) await page.getByText('Layout a due colonne').click()
    await page.getByRole('button', { name: 'Salva e Chiudi' }).click()
    await settle(400)

    const pdf = path.join(outDir, v.file)
    rmSync(pdf, { force: true })
    await app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: p }) }, pdf)
    await page.locator('header button').filter({ hasText: 'Esporta Libro (PDF)' }).first().click()
    const start = Date.now()
    while (!existsSync(pdf) && Date.now() - start < 300000) await page.waitForTimeout(500)
    if (!existsSync(pdf)) throw new Error(`esportazione non riuscita: ${v.file}`)
    await page.waitForFunction(() => !document.body.innerText.includes('Generazione'), null, { timeout: 120000 })
    console.log(`ok   ${v.file} (${(statSync(pdf).size / 1024).toFixed(0)} KB)`)
  }
} catch (error) {
  console.error(`FAIL ${String(error?.message ?? error).split('\n')[0]}`)
  if (page) await page.screenshot({ path: path.join(outDir, 'errore.png') }).catch(() => {})
  process.exitCode = 1
} finally {
  await app.close().catch(() => {})
  rmSync(work, { recursive: true, force: true })
}
