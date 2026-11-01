import { rename, writeFile } from 'node:fs/promises'

/** Scrittura atomica: file temporaneo nella stessa cartella, poi rinomina */
export async function writeAtomic(target: string, data: Uint8Array) {
  const tmp = `${target}.tmp`
  await writeFile(tmp, data)
  await rename(tmp, target)
}

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e))