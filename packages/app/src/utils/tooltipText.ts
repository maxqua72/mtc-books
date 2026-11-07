/** Separa il testo dalla scorciatoia finale: "Grassetto (Ctrl+B)" → testo "Grassetto", scorciatoia "Ctrl+B" */
export function splitTooltip(value: string): { text: string; shortcut: string | null } {
  const match = /^(.*\S)\s+\((Ctrl\+[^)]+)\)$/.exec(value)
  return match ? { text: match[1], shortcut: match[2] } : { text: value, shortcut: null }
}
