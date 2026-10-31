import { pdfPageOptions } from '@mtc/pdf-core'

const expected: Record<string, unknown> = {
  'crown-quarto': { width: '189mm', height: '246mm' },
  'b-format': { width: '129mm', height: '198mm' },
  'a4': { format: 'a4' },
  'A4': { format: 'A4' },
}

let bad = 0
for (const [input, want] of Object.entries(expected)) {
  const got = pdfPageOptions(input)
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) bad++
  console.log(ok ? 'OK ' : 'ERR', input, JSON.stringify(got))
}
process.exit(bad ? 1 : 0)