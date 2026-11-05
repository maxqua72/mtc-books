import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'
const d = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../desktop')
const a = await electron.launch({ executablePath: createRequire(path.join(d, 'package.json'))('electron'), args: ['.', '--dist', '--no-sandbox'], cwd: d })
const r = await a.evaluate(({ app }) => [app.getName(), app.getPath('userData')])
console.log(r); await a.close()
if (r[0] !== 'MTC Books' || path.basename(r[1]) !== 'MTC Books') process.exit(1)
