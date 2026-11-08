// Rilascio di una nuova versione: verifiche, nuova versione, build della web app, commit, tag e push.
//
//   pnpm release            correzione:  1.0.1 -> 1.0.2
//   pnpm release minor      nuova funzione: 1.0.2 -> 1.1.0
//   pnpm release major      cambiamento importante: 1.1.0 -> 2.0.0
//
// Opzioni: --dry-run mostra cosa farebbe senza toccare nulla; --yes non chiede conferma.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const VERSION_FILES = ['package.json', 'packages/desktop/package.json']
const LEVELS = ['patch', 'minor', 'major']

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const yes = args.includes('--yes')
const level = args.find((a) => !a.startsWith('--')) ?? 'patch'

const fail = (msg) => {
  console.error(`\nERRORE: ${msg}`)
  process.exit(1)
}
const step = (msg) => console.log(`\n==> ${msg}`)
const run = (cmd) => execSync(cmd, { stdio: 'inherit' })
const read = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const versionOf = (file) => JSON.parse(readFileSync(file, 'utf8')).version

if (!LEVELS.includes(level)) fail(`livello "${level}" non valido: usa ${LEVELS.join(', ')} (predefinito: patch)`)

// --- Controlli sul repository ---
const branch = read('git rev-parse --abbrev-ref HEAD')
if (branch !== 'main') fail(`sei sul ramo "${branch}": il rilascio si fa da main`)

if (read('git status --porcelain')) fail('ci sono modifiche non salvate in un commit: fai commit o annullale prima del rilascio')

step('Allineamento con GitHub')
run('git fetch origin --tags')
const behind = Number(read('git rev-list --count HEAD..origin/main'))
if (behind > 0) fail(`main locale è indietro di ${behind} commit rispetto a GitHub: esegui git pull`)

// --- Calcolo della nuova versione ---
const current = versionOf(VERSION_FILES[0])
const desktop = versionOf(VERSION_FILES[1])
if (current !== desktop) fail(`versioni incoerenti: radice ${current}, desktop ${desktop}`)
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current)
if (!m) fail(`versione attuale non valida: ${current}`)
let [major, minor, patch] = m.slice(1).map(Number)
if (level === 'major') [major, minor, patch] = [major + 1, 0, 0]
else if (level === 'minor') [minor, patch] = [minor + 1, 0]
else patch++
const next = `${major}.${minor}.${patch}`
const tag = `v${next}`

if (read(`git tag --list ${tag}`) || read(`git ls-remote --tags origin refs/tags/${tag}`)) fail(`il tag ${tag} esiste già`)

console.log(`\nVersione attuale: ${current}`)
console.log(`Nuova versione:   ${next} (${level})`)
console.log(`Passi: verifiche, versione ${next} nei package.json, build web, commit "Versione ${next}", tag ${tag}, push su GitHub`)

if (dryRun) {
  console.log('\n--dry-run: nessuna modifica eseguita.')
  process.exit(0)
}

if (!yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`\nProcedo con il rilascio ${next}? (s/N) `)).trim().toLowerCase()
  rl.close()
  if (answer !== 's' && answer !== 'si' && answer !== 'sì') fail('rilascio annullato')
}

// --- Verifiche (le stesse della CI) ---
step('Verifiche')
try {
  run('pnpm check:boundaries')
  run('pnpm typecheck')
  run('pnpm test')
} catch {
  fail('le verifiche non sono passate: nessuna modifica eseguita')
}

// --- Nuova versione e build della web app ---
step(`Versione ${next}`)
read(`node scripts/set-version.mjs ${next}`)

step('Build della web app')
try {
  run('pnpm --filter @mtc/app build')
} catch {
  run(`git checkout -- ${VERSION_FILES.join(' ')}`)
  fail(`build non riuscita: versione riportata a ${current}, nessun commit eseguito`)
}

// --- Commit, tag e push ---
step('Commit, tag e push')
run(`git add ${VERSION_FILES.join(' ')}`)
run(`git commit -m "Versione ${next}"`)
run(`git tag ${tag}`)
try {
  run(`git push --atomic origin main ${tag}`)
} catch {
  fail(`push non riuscito. Commit e tag ${tag} sono solo in locale: risolvi il problema e riprova con\n  git push --atomic origin main ${tag}`)
}

console.log(`
Rilascio ${next} avviato.

Web app (books.mindthecheck.com):
  1. Con WinSCP carica il CONTENUTO di packages\\app\\dist in $HOME/mtc-books (modalità Binaria)
  2. Sul server:  sudo ~/deploy-books.sh ${next}

App desktop:
  3. Su GitHub > Actions attendi la fine di "Release" (${tag})
  4. In https://github.com/maxqua72/mtc-books-releases/releases apri la bozza ${next} e pubblicala
`)
