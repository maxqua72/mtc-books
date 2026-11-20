// File di diagrammi affiancati: due diagrammi di seguito, uno a sinistra e uno a destra (vedi book-typography.css)
import type { Node as PMNode } from '@tiptap/pm/model'

/** Il minimo che serve sapere di un blocco di primo livello */
export interface BlockInfo {
  diagram: boolean
  align: 'left' | 'center' | 'right'
  emptyParagraph: boolean
}

const side = (b: BlockInfo | undefined) => b?.diagram && b.align !== 'center' ? b.align : null

/** true se il blocco `i` è il secondo diagramma di una fila completa (il precedente è sul lato opposto) */
export const closesRow = (blocks: BlockInfo[], i: number): boolean => {
  const a = side(blocks[i - 1])
  const b = side(blocks[i])
  return !!a && !!b && a !== b
}

/**
 * Inserimento con il cursore in un paragrafo vuoto (`i`): il diagramma prende il posto del paragrafo
 * se subito prima c'è un diagramma singolo. Dopo una fila completa no: quel paragrafo serve a scrivere tra due file.
 */
export const diagramReplacesEmptyParagraph = (blocks: BlockInfo[], i: number): boolean =>
  !!blocks[i]?.emptyParagraph && !!blocks[i - 1]?.diagram && !closesRow(blocks, i - 1)

export interface PairPlan {
  /** indice del diagramma precedente */
  previous: number
  /** indice del paragrafo vuoto in mezzo da togliere (null se i due diagrammi sono già di seguito) */
  emptyBetween: number | null
  /** già affiancati: il comando non ha niente da fare */
  done: boolean
}

/**
 * «Affianca al diagramma precedente» per il diagramma `i`: serve un diagramma subito prima (al massimo con un
 * paragrafo vuoto in mezzo) che non chiuda già un'altra fila. null se il comando non si può usare.
 */
export const planPair = (blocks: BlockInfo[], i: number): PairPlan | null => {
  if (!blocks[i]?.diagram) return null
  let previous = i - 1
  let emptyBetween: number | null = null
  if (blocks[previous]?.emptyParagraph) {
    emptyBetween = previous
    previous--
  }
  if (previous < 0 || !blocks[previous]?.diagram || closesRow(blocks, previous)) return null
  const done = emptyBetween === null && side(blocks[previous]) === 'left' && side(blocks[i]) === 'right'
  return { previous, emptyBetween, done }
}

/** Descrizione dei blocchi di primo livello del documento */
export const describeBlocks = (doc: PMNode): BlockInfo[] => {
  const blocks: BlockInfo[] = []
  doc.forEach(node => {
    const align = node.attrs?.align
    blocks.push({
      diagram: node.type.name === 'chessDiagram',
      align: align === 'left' || align === 'right' ? align : 'center',
      emptyParagraph: node.type.name === 'paragraph' && node.content.size === 0,
    })
  })
  return blocks
}

/** Posizione d'inizio del blocco di primo livello `i` */
export const blockStart = (doc: PMNode, i: number): number => {
  let pos = 0
  for (let k = 0; k < i; k++) pos += doc.child(k).nodeSize
  return pos
}
