// Layout a due colonne: unica fonte delle regole, per editor, PDF e finestra Proprietà
import { getPageSizeMm } from './pageFormats'

export const COLUMN_GAP_MM = 8

/** B-Format è escluso: le colonne resterebbero larghe circa 40 mm */
export const twoColumnsAvailable = (pageFormat?: string): boolean => pageFormat !== 'b-format'

/** Larghezza di una colonna in mm, dati formato e margini laterali */
export const columnWidthMm = (pageFormat: string | undefined, marginLeftMm: number, marginRightMm: number): number =>
  (getPageSizeMm(pageFormat).width - marginLeftMm - marginRightMm - COLUMN_GAP_MM) / 2
