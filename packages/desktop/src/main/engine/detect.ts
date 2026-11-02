import { readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const NAME = /^stockfish[\w.-]*$/i
const EXEC = process.platform === 'win32' ? /\.exe$/i : /^[^.]*$|\.(bin|appimage)$/i

/** Cerca eseguibili di Stockfish nel PATH e in alcune cartelle comuni */
export async function detectEngines(): Promise<string[]> {
  const home = os.homedir()
  const dirs = new Set<string>((process.env.PATH ?? '').split(path.delimiter).filter(Boolean))
  if (process.platform === 'win32') {
    ;['C:\\Stockfish', 'C:\\Engines', path.join(home, 'Stockfish'), path.join(home, 'Engines'),
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Stockfish')].forEach((d) => dirs.add(d))
  } else {
    ;['/usr/games', '/usr/local/bin', '/opt/homebrew/bin', path.join(home, 'Stockfish')].forEach((d) => dirs.add(d))
  }
  const found = new Set<string>()
  for (const dir of dirs) {
    let entries: string[]
    try { entries = await readdir(dir) } catch { continue }
    for (const name of entries) {
      if (!NAME.test(name) || !EXEC.test(name)) continue
      const file = path.join(dir, name)
      try { if ((await stat(file)).isFile()) found.add(file) } catch { /* illeggibile */ }
    }
  }
  return [...found]
}