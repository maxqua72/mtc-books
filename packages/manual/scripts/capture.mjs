// Rigenera gli screenshot del manuale fotografando la vera app desktop con un libro di esempio.
// Prerequisiti: pnpm --filter @mtc/app build, poi in packages/desktop: node scripts/copy-assets.mjs && pnpm exec tsup
// Avvio: pnpm --filter @mtc/manual screenshots
// Usa una cartella dati temporanea: i libri e i profili motore dell'utente non vengono toccati.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(here, '../../desktop')
const outDir = path.resolve(here, '../public/screenshots')
const debugDir = process.env.MANUAL_DEBUG_DIR
const userData = mkdtempSync(path.join(tmpdir(), 'mtc-manual-'))
mkdirSync(outDir, { recursive: true })

const PGN = `[Event "Parigi"]
[White "Morphy, Paul"]
[Black "Duca di Brunswick e Conte Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 {Una scelta passiva.} 4. dxe5 Bxf3 5. Qxf3 dxe5
6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 (9... Qc7 {era più solida.}) 10. Nxb5 cxb5
11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7
16. Qb8+ Nxb8 17. Rd8# 1-0`

const failures = []
let page

const step = async (name, run) => {
  try {
    await run()
    console.log(`ok   ${name}`)
  } catch (error) {
    failures.push(name)
    console.error(`FAIL ${name}: ${String(error?.message ?? error).split('\n')[0]}`)
    if (debugDir) await page.screenshot({ path: path.join(debugDir, `fail-${name}.png`) }).catch(() => {})
    await page.keyboard.press('Escape').catch(() => {})
  }
}

const shot = (name, target = page) => target.screenshot({ path: path.join(outDir, `${name}.png`), animations: 'disabled' })
const button = (name) => page.getByRole('button', { name, exact: false }).first()
const left = () => page.locator('aside').first()
const right = () => page.locator('aside.th-right')
const tab = async (name) => { await right().getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(200) }
const settle = () => page.waitForTimeout(400)
// Finestra alta per i pannelli che altrimenti scorrono
const resize = async (height) => {
  await app.evaluate(({ BrowserWindow }, h) => BrowserWindow.getAllWindows()[0].setContentSize(1440, h), height)
  await page.waitForTimeout(500)
}
const clip = async (name, box) => page.screenshot({ path: path.join(outDir, `${name}.png`), clip: box })
// Le mosse sono disegnate con le figurine: si cercano per posizione, non per testo
const moves = () => page.locator('.chess-tree-block-container').first().locator('.chess-move-item')
const QB3 = 12, BXB5 = 21

const app = await electron.launch({
  executablePath: createRequire(path.join(desktopDir, 'package.json'))('electron'),
  args: ['.', '--dist', '--no-sandbox', '--force-device-scale-factor=2', `--user-data-dir=${userData}`],
  cwd: desktopDir,
})

try {
  const actual = await app.evaluate(({ app: a }) => a.getPath('userData'))
  if (path.resolve(actual) !== path.resolve(userData)) throw new Error(`Cartella dati inattesa: ${actual}`)

  page = await app.firstWindow()
  page.on('dialog', (d) => { console.log(`dialogo: ${d.message().slice(0, 90)}`); void d.accept() })
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('button', { name: 'Crea un nuovo libro' }).waitFor()
  await settle()

  await step('schermata-iniziale', () => clip('schermata-iniziale', { x: 0, y: 0, width: 1440, height: 800 }))

  await step('nuovo-libro', async () => {
    await button('Crea un nuovo libro').click()
    await settle()
    await clip('nuovo-libro', { x: 0, y: 0, width: 1440, height: 800 })
    await page.getByPlaceholder('Es. Le mie Grandi Partite').fill('Le partite immortali')
    await page.getByPlaceholder('Nome Cognome').fill('Autore di esempio')
    await button('Inizia a scrivere').click()
    await page.locator('.ProseMirror').first().waitFor()
    await settle()
  })

  await step('testo', async () => {
    const editor = page.locator('.ProseMirror').first()
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('La partita dell’Opera')
    await page.getByTitle('Stili del paragrafo').click()
    await page.getByRole('menuitem', { name: 'Titolo 1' }).click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.getByTitle('Stili del paragrafo').click()
    await page.getByRole('menuitem', { name: 'Testo normale' }).click()
    await page.keyboard.type('Parigi, 1858: Paul Morphy gioca in un palco del teatro dell’Opera e mostra quanto valgano sviluppo rapido e iniziativa.')
    await page.keyboard.press('Enter')
    await settle()
  })

  await step('import-pgn', async () => {
    await tab('Importa PGN')
    await right().locator('textarea').fill(PGN)
    await settle()
    await resize(1560)
    await shot('import-pgn', right())
    await resize(900)
    await button('Importa nel documento').click()
    await page.locator('.chess-tree-block-container').first().waitFor()
    await settle()
  })

  await step('diagramma', async () => {
    const block = page.locator('.chess-tree-block-container').first()
    await moves().last().click()
    await settle()
    await button('Inserisci Diagramma').click()
    const diagram = page.locator('.chess-diagram-container').first()
    await diagram.waitFor()
    await settle()
    const card = diagram.locator('.diagram-card')
    await card.hover()
    await page.getByTitle(/^Modifica didascalia/).first().click()
    await page.keyboard.type('Matto del Bianco: 17. Td8#')
    await page.keyboard.press('Enter')
    await settle()
    await card.hover()
    await page.waitForTimeout(400)
    const box = await card.boundingBox()
    await clip('diagramma', { x: box.x - 70, y: box.y - 16, width: box.width + 220, height: box.height + 32 })
  })

  await step('area-lavoro', async () => {
    await tab('FEN') // l'importazione PGN aperta mostra un segnaposto nel documento
    await moves().nth(BXB5).click()
    await settle()
    await page.mouse.move(5, 5)
    await settle()
    await shot('area-lavoro')
  })

  await step('albero-mosse', async () => {
    const block = page.locator('.chess-tree-block-container').first()
    await block.hover()
    await settle()
    await shot('albero-mosse', block)
  })

  await step('simboli', async () => {
    await tab('Simboli')
    await resize(1400)
    await shot('simboli', right())
  })

  await step('fen', async () => {
    await tab('FEN')
    await shot('console-fen', right())
  })

  await step('editor-scacchiera', async () => {
    await button('Scollega').click()
    await settle()
    await button('Editor scacchiera').click()
    await settle()
    await resize(1560)
    await shot('editor-scacchiera', right())
    await button('Annulla').click()
    await resize(900)
  })

  await step('proprieta', async () => {
    await page.getByTitle('Proprietà Libro').click()
    await settle()
    await shot('proprieta-libro')
    await button('Salva e Chiudi').click()
    await settle()
  })

  await step('impostazioni', async () => {
    await page.getByTitle(/^Impostazioni/).click()
    await settle()
    await shot('impostazioni')
    await page.keyboard.press('Escape')
    await settle()
  })

  await step('copertina', async () => {
    await left().getByRole('button', { name: 'Copertina' }).click()
    await settle()
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas')
      c.width = 900; c.height = 1270
      const x = c.getContext('2d')
      const g = x.createLinearGradient(0, 0, 0, 1270)
      g.addColorStop(0, '#1f2d3d'); g.addColorStop(1, '#6b7f8f')
      x.fillStyle = g; x.fillRect(0, 0, 900, 1270)
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) if ((r + f) % 2) {
        x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(90 + f * 90, 450 + r * 90, 90, 90)
      }
      return c.toDataURL('image/png').split(',')[1]
    })
    await page.locator('input[type=file][accept*="image/png"]').setInputFiles({
      name: 'sfondo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
    })
    await page.getByText('Cambia immagine').waitFor()
    await button('Aggiungi testo').click()
    await settle()
    const text = page.getByText('Testo', { exact: true }).last()
    await text.dblclick()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Le partite immortali')
    await page.locator('main').getByRole('button', { name: 'Aggiungi testo' }).hover()
    await page.locator('.ProseMirror, main').first().evaluate(() => document.activeElement?.blur())
    await settle()
    await resize(1400)
    await shot('copertina', page.locator('main'))
    await resize(900)
  })

  await step('indice', async () => {
    await left().getByRole('button', { name: 'Indice' }).click()
    await settle()
    await shot('indice', page.locator('main'))
  })

  await step('sezioni', async () => {
    await left().getByRole('button', { name: 'Nuovo Capitolo' }).click()
    await settle()
    await left().getByText('La partita dell’Opera').first().hover()
    await settle()
    await shot('sezioni', left())
  })

  await step('menu-file', async () => {
    await left().getByText('La partita dell’Opera').first().click()
    await settle()
    await page.getByTitle('Scegli come salvare').click()
    await settle()
    const width = page.viewportSize()?.width ?? await page.evaluate(() => innerWidth)
    await page.screenshot({ path: path.join(outDir, 'menu-salva.png'), clip: { x: width - 560, y: 0, width: 560, height: 170 } })
    await page.getByTitle('Scegli come salvare').click()
    await page.locator('header').getByRole('button', { name: /Esporta/ }).nth(1).click()
    await settle()
    await page.screenshot({ path: path.join(outDir, 'menu-esporta.png'), clip: { x: width - 620, y: 0, width: 620, height: 170 } })
    await page.mouse.click(700, 500)
    await settle()
  })

  await step('motore', async () => {
    await tab('Motore')
    await button('Cerca Stockfish').click()
    await right().getByRole('button', { name: 'Aggiungi', exact: true }).first().click({ timeout: 20000 })
    const toggle = right().getByRole('switch')
    await toggle.waitFor({ timeout: 20000 })
    if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click()
    await moves().nth(QB3).click()
    await right().getByText(/Profondità \d/).waitFor({ timeout: 30000 })
    await page.waitForTimeout(4000)
    await resize(1700)
    await shot('motore', right())
    await resize(900)
  })

  // Prova del manuale nella finestra vera, con la CSP vera
  await step('manuale', async () => {
    const opened = app.waitForEvent('window')
    await page.getByTitle('Manuale utente').click()
    const manual = await opened
    await manual.setViewportSize({ width: 1100, height: 760 }).catch(() => {})
    const problems = []
    manual.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
    manual.on('pageerror', (e) => problems.push(String(e)))
    await manual.waitForLoadState('load')
    await manual.waitForTimeout(1500)
    if (debugDir) await manual.screenshot({ path: path.join(debugDir, 'manuale-home.png') })
    await manual.locator('.VPSidebar').waitFor({ timeout: 15000 })
    await manual.locator('.VPSidebar').getByRole('link', { name: 'Diagrammi' }).click({ timeout: 10000 })
    await manual.getByRole('heading', { name: 'Diagrammi', level: 1 }).waitFor({ timeout: 15000 })
    await manual.locator('.VPNavBarSearch button').first().click({ timeout: 10000 })
    await manual.getByRole('searchbox').or(manual.locator('input[type=search], .search-input')).first().fill('promozione')
    await manual.waitForTimeout(1500)
    console.log(`manuale: url ${manual.url()}, errori console ${problems.length}`)
    problems.slice(0, 10).forEach((p) => console.log(`  ${p}`))
    if (debugDir) await manual.screenshot({ path: path.join(debugDir, 'manuale-ricerca.png') })
    if (problems.length) throw new Error(`errori nella console del manuale: ${problems.length}`)
  })
} finally {
  await app.close().catch(() => {})
  rmSync(userData, { recursive: true, force: true })
}

if (debugDir) writeFileSync(path.join(debugDir, 'esito.txt'), failures.join('\n') || 'tutto ok')
if (failures.length) {
  console.error(`Passi non riusciti: ${failures.join(', ')}`)
  process.exitCode = 1
}
