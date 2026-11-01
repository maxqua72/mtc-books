import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const RULES = {
  app: ['node:', 'electron', 'playwright', 'express', '@mtc/pdf-core', '@mtc/server'],
  shared: ['node:', 'electron', 'playwright', 'vue', 'pinia', '@mtc/'],
  'pdf-core': ['electron', 'playwright', 'node:fs', '@mtc/app', '@mtc/server'],
  server: ['electron', '@mtc/app'],
  desktop: ['@mtc/app', '@mtc/server'],
}

const matches = (spec, rule) =>
  rule.endsWith(':') || rule.endsWith('/') ? spec.startsWith(rule) : spec === rule || spec.startsWith(rule + '/')

function* files(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* files(p)
    else if (['.ts', '.vue'].includes(extname(p))) yield p
  }
}

let errors = 0
for (const [pkg, forbidden] of Object.entries(RULES)) {
  for (const file of files(join('packages', pkg, 'src'))) {
    const text = readFileSync(file, 'utf-8')
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      if (forbidden.some((r) => matches(m[1], r))) {
        console.error(`[${pkg}] ${file}: import non ammesso "${m[1]}"`)
        errors++
      }
    }
  }
}
console.log(errors ? `${errors} violazioni` : 'Confini rispettati')
process.exit(errors ? 1 : 0)