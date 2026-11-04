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

  await step('schermata-iniziale', () => shot('schermata-iniziale'))

  await step('nuovo-libro', async () => {
    await button('Crea un nuovo libro').click()
    await settle()
    await shot('nuovo-libro')
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
    await shot('import-pgn', right())
    await button('Importa nel documento').click()
    await page.locator('.chess-tree-block-container').first().waitFor()
    await settle()
  })

  await step('diagramma', async () => {
    const block = page.locator('.chess-tree-block-container').first()
    await block.getByText('Rd8#').first().click()
    await settle()
    await button('Inserisci Diagramma').click()
    const diagram = page.locator('.chess-diagram-container').first()
    await diagram.waitFor()
    await settle()
    await diagram.hover()
    await settle()
    await shot('diagramma', diagram.locator('xpath=ancestor-or-self::*[contains(@class,"react-renderer") or contains(@class,"node-view")][1]').or(diagram).first())
  })

  await step('area-lavoro', async () => {
    const block = page.locator('.chess-tree-block-container').first()
    await block.getByText('Bxb5+').first().click()
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
    await shot('editor-scacchiera', right())
    await button('Annulla').click()
    await settle()
  })

  await step('sezioni', () => shot('sezioni', left()))

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
    await shot('copertina', page.locator('main'))
  })

  await step('indice', async () => {
    await left().getByRole('button', { name: 'Indice' }).click()
    await settle()
    await shot('indice', page.locator('main'))
  })

  await step('menu-file', async () => {
    await left().getByText('La partita dell’Opera').first().click()
    await settle()
    await page.getByTitle('Scegli come salvare').click()
    await settle()
    await shot('menu-salva', page.locator('header'))
    await page.keyboard.press('Escape')
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
    await page.locator('.chess-tree-block-container').first().getByText('Qb3').first().click()
    await right().getByText(/Profondità \d/).waitFor({ timeout: 30000 })
    await page.waitForTimeout(4000)
    await shot('motore', right())
  })

  // Prova del manuale nella finestra vera, con la CSP vera
  await step('manuale', async () => {
    const opened = app.waitForEvent('window')
    await page.getByTitle('Manuale utente').click()
    const manual = await opened
    const problems = []
    manual.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
    manual.on('pageerror', (e) => problems.push(String(e)))
    await manual.waitForLoadState('load')
    await manual.locator('.VPSidebar').waitFor({ timeout: 15000 })
    await manual.getByRole('link', { name: 'Diagrammi' }).first().click()
    await manual.getByRole('heading', { name: 'Diagrammi', level: 1 }).waitFor({ timeout: 15000 })
    await manual.getByRole('button', { name: /Cerca/ }).first().click()
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
