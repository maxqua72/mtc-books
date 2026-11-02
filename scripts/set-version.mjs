import { readFileSync, writeFileSync } from 'node:fs'

const version = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Uso: pnpm version:set <x.y.z>')
  process.exit(2)
}
for (const file of ['package.json', 'packages/desktop/package.json']) {
  const text = readFileSync(file, 'utf8')
  const next = text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`)
  if (next === text) console.warn(`${file}: la versione era già ${version} (o il campo non è stato trovato)`)
  writeFileSync(file, next)
}
console.log(`Versione impostata a ${version}. Poi: git commit, git tag v${version}, git push --tags`)