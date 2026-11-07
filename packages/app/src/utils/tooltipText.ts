/**
 * Separa il testo dalla scorciatoia finale: "Grassetto (Ctrl+B)" → testo "Grassetto", scorciatoia "Ctrl+B".
 * Valgono come scorciatoia Ctrl+…, Esc, Home, Fine, le frecce e una sola lettera maiuscola, come "Donna (Q)".
 */
export function splitTooltip(value: string): { text: string; shortcut: string | null } {
  const match = /^(.*\S)\s+\((Ctrl\+[^)]+|Esc|Home|Fine|[←↑→↓]|[A-Z])\)$/.exec(value)
  return match ? { text: match[1], shortcut: match[2] } : { text: value, shortcut: null }
}
