// Spazio per la rilegatura: unica fonte delle regole, per editor, PDF e finestra Proprietà
export type Binding = 'none' | 'left' | 'duplex'

/** Spazio aggiunto al margine interno: basta per spirale, anelli o punti metallici */
export const BINDING_MM = 10

export const normalizeBinding = (v: unknown): Binding => (v === 'left' || v === 'duplex' ? v : 'none')

export const bindingMm = (binding: Binding): number => (binding === 'none' ? 0 : BINDING_MM)

/**
 * Regole @page per il fronte/retro: nelle pagine pari (a sinistra) la rilegatura passa al margine destro.
 * Le pagine dispari usano i margini normali, con la rilegatura già sommata al margine sinistro.
 * La copertina ha un @page con nome, più specifico di :left, e resta senza margini.
 */
export const bindingPageCss = (binding: Binding, leftMm: number, rightMm: number): string => {
  if (binding !== 'duplex') return ''
  const gutter = bindingMm(binding)
  return `@page :left { margin-left: ${leftMm - gutter}mm !important; margin-right: ${rightMm + gutter}mm !important; }`
}
