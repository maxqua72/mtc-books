// Simboli di annotazione PGN (NAG): quali offre l'interfaccia e come si scrivono nel testo.
// Per aggiungerne uno basta una riga qui: console, rendering e PDF lo seguono.
// Si usano caratteri ASCII dove possibile; ∞ □ ∆ ∇ vanno verificati nel PDF (font Lora + fallback di Chromium).

export interface NagDef { code: number; symbol: string; label: string }
export interface NagGroup {
  id: 'quality' | 'eval' | 'other'
  title: string
  exclusive: boolean   // al massimo un simbolo del gruppo per mossa
  items: NagDef[]
}

export const NAG_GROUPS: NagGroup[] = [
  {
    id: 'quality', title: 'Qualità della mossa', exclusive: true,
    items: [
      { code: 1, symbol: '!', label: 'Buona mossa' },
      { code: 2, symbol: '?', label: 'Errore' },
      { code: 3, symbol: '!!', label: 'Mossa eccellente' },
      { code: 4, symbol: '??', label: 'Grave errore' },
      { code: 5, symbol: '!?', label: 'Mossa interessante' },
      { code: 6, symbol: '?!', label: 'Mossa dubbia' },
      { code: 7, symbol: '□', label: 'Mossa obbligata' },
    ],
  },
  {
    id: 'eval', title: 'Valutazione della posizione', exclusive: true,
    items: [
      { code: 10, symbol: '=', label: 'Posizione pari' },
      { code: 13, symbol: '∞', label: 'Posizione poco chiara' },
      { code: 14, symbol: '+=', label: 'Il Bianco sta leggermente meglio' },
      { code: 15, symbol: '=+', label: 'Il Nero sta leggermente meglio' },
      { code: 16, symbol: '+/-', label: 'Il Bianco sta meglio' },
      { code: 17, symbol: '-/+', label: 'Il Nero sta meglio' },
      { code: 18, symbol: '+-', label: 'Vantaggio decisivo del Bianco' },
      { code: 19, symbol: '-+', label: 'Vantaggio decisivo del Nero' },
      { code: 20, symbol: '+--', label: 'Vantaggio schiacciante del Bianco' },
      { code: 21, symbol: '--+', label: 'Vantaggio schiacciante del Nero' },
    ],
  },
  {
    id: 'other', title: 'Altri simboli', exclusive: false,
    items: [
      { code: 140, symbol: '∆', label: 'Con l’idea' },
      { code: 141, symbol: '∇', label: 'Contro l’idea' },
      { code: 146, symbol: 'N', label: 'Novità teorica' },
    ],
  },
]

const GROUP_BY_CODE = new Map<number, NagGroup>()
NAG_GROUPS.forEach(g => g.items.forEach(i => GROUP_BY_CODE.set(i.code, g)))

/** Aggiunge o toglie un NAG. Nei gruppi esclusivi il nuovo sostituisce quello precedente. */
export const toggleNagInList = (nags: number[], code: number): number[] => {
  if (nags.includes(code)) return nags.filter(n => n !== code)
  const group = GROUP_BY_CODE.get(code)
  const base = group?.exclusive
    ? nags.filter(n => !group.items.some(i => i.code === n))
    : nags
  return [...base, code]
}

/** Testo da mostrare dopo la mossa ("!?", " +=", "!! +-"...). I NAG sconosciuti (da PGN) non si mostrano. */
export const nagsToText = (nags?: number[]): string => {
  if (!nags?.length) return ''
  const parts: string[] = []
  let hasQuality = false
  for (const g of NAG_GROUPS) {
    const symbols = g.items.filter(i => nags.includes(i.code)).map(i => i.symbol)
    if (!symbols.length) continue
    if (g.id === 'quality') hasQuality = true
    parts.push(symbols.join(g.id === 'quality' ? '' : ' '))
  }
  if (!parts.length) return ''
  // il simbolo di qualità va attaccato alla mossa; gli altri ne sono staccati
  return (hasQuality ? '' : ' ') + parts.join(' ')
}
