import { isValidFen } from './sanitize'

export function fenToBoardString(fen: string, flipped = false): string {
  if (!isValidFen(fen)) return ''

  // Font Chess Merida: ogni pezzo ha un glifo per la casa chiara e uno per la scura
  const keymap: Record<string, { light: string; dark: string }> = {
    'P': { light: 'p', dark: 'P' }, 'p': { light: 'o', dark: 'O' },
    'N': { light: 'n', dark: 'N' }, 'n': { light: 'm', dark: 'M' },
    'B': { light: 'b', dark: 'B' }, 'b': { light: 'v', dark: 'V' },
    'R': { light: 'r', dark: 'R' }, 'r': { light: 't', dark: 'T' },
    'Q': { light: 'q', dark: 'Q' }, 'q': { light: 'w', dark: 'W' },
    'K': { light: 'k', dark: 'K' }, 'k': { light: 'l', dark: 'L' }
  }

  const isDarkSquare = (row: number, col: number) => (row + col) % 2 === 1

  // Ogni traversa diventa 8 celle ('' = vuota), dall'alto in basso come nel FEN
  let ranks: string[][] = fen.split(' ')[0].split('/').map(row => {
    const cells: string[] = []
    for (const ch of row) {
      if (isNaN(Number(ch))) cells.push(ch)
      else for (let i = 0; i < Number(ch); i++) cells.push('')
    }
    return cells
  })

  // Glifi del bordo con le coordinate: traverse dall'ottava alla prima, colonne dalla a alla h
  let leftBorderCodes = [199, 198, 197, 196, 195, 194, 193, 192]
  let bottomCoords = 'ÈÉÊËÌÍÎÏ'

  if (flipped) {
    ranks = ranks.reverse().map(r => r.reverse())
    leftBorderCodes = leftBorderCodes.reverse()
    bottomCoords = [...bottomCoords].reverse().join('')
  }

  let output = '1222222223\n'
  ranks.forEach((cells, rowIndex) => {
    let rowText = String.fromCharCode(leftBorderCodes[rowIndex])
    cells.forEach((cell, colIndex) => {
      const dark = isDarkSquare(rowIndex, colIndex)
      rowText += cell ? (dark ? keymap[cell].dark : keymap[cell].light) : (dark ? '+' : ' ')
    })
    output += rowText + '5\n'
  })

  output += `7${bottomCoords}9`
  return output
}