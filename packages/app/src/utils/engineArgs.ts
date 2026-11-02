/** Argomenti di avvio scritti in una riga: separati da spazi, con le virgolette per quelli che ne contengono */
export function parseArgs(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/"([^"]*)"|(\S+)/g)) out.push(m[1] ?? m[2])
  return out
}

export const formatArgs = (args: string[]): string =>
  args.map((a) => (a === '' || /\s/.test(a) ? `"${a}"` : a)).join(' ')