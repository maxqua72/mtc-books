// utils/chessFormatter.ts
import { isValidFen } from './sanitize'

export function fenToBoardString(fen: string): string {
  if (!isValidFen(fen)) return ''
  
  const fenRows = fen.split(' ')[0].split('/')
  const keymap: Record<string, { light: string; dark: string }> = {
    'P': { light: 'p', dark: 'P' }, 'p': { light: 'o', dark: 'O' },
    'N': { light: 'n', dark: 'N' }, 'n': { light: 'm', dark: 'M' },
    'B': { light: 'b', dark: 'B' }, 'b': { light: 'v', dark: 'V' },
    'R': { light: 'r', dark: 'R' }, 'r': { light: 't', dark: 'T' },
    'Q': { light: 'q', dark: 'Q' }, 'q': { light: 'w', dark: 'W' },
    'K': { light: 'k', dark: 'K' }, 'k': { light: 'l', dark: 'L' }
  }

  const isDarkSquare = (row: number, col: number) => (row + col) % 2 === 1

  let output = '1222222223\n'
  const leftBorderCodes = [199, 198, 197, 196, 195, 194, 193, 192]

  fenRows.forEach((fenRow: string, rowIndex: number) => {
    let rowText = String.fromCharCode(leftBorderCodes[rowIndex])
    let colIndex = 0

    for (const char of fenRow) {
      if (isNaN(Number(char))) {
        const dark = isDarkSquare(rowIndex, colIndex)
        rowText += dark ? keymap[char].dark : keymap[char].light
        colIndex++
      } else {
        const emptyCount = Number(char)
        for (let i = 0; i < emptyCount; i++) {
          const dark = isDarkSquare(rowIndex, colIndex)
          rowText += dark ? '+' : ' '
          colIndex++
        }
      }
    }
    output += rowText + '5\n'
  })

  const bottomCoords = 'ÈÉÊËÌÍÎÏ'
  output += `7${bottomCoords}9`

  return output
}