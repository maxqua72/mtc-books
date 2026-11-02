// Genera build/icon.png (1024) e build/icon.ico (più dimensioni) da build/icon.svg
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const build = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'build')
const svg = await readFile(path.join(build, 'icon.svg'))
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

const png = (size) =>
  sharp(svg).resize(size, size, { fit: 'contain', background: TRANSPARENT }).png().toBuffer()

// ICO con immagini PNG all'interno (supportato da Windows Vista in poi)
function buildIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const entries = Buffer.alloc(16 * images.length)
  let offset = 6 + entries.length
  images.forEach(({ size, data }, i) => {
    const o = i * 16
    entries.writeUInt8(size >= 256 ? 0 : size, o)
    entries.writeUInt8(size >= 256 ? 0 : size, o + 1)
    entries.writeUInt8(0, o + 2)
    entries.writeUInt8(0, o + 3)
    entries.writeUInt16LE(1, o + 4)
    entries.writeUInt16LE(32, o + 6)
    entries.writeUInt32LE(data.length, o + 8)
    entries.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  return Buffer.concat([header, entries, ...images.map((i) => i.data)])
}

const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const images = await Promise.all(sizes.map(async (size) => ({ size, data: await png(size) })))

await writeFile(path.join(build, 'icon.png'), await png(1024))
await writeFile(path.join(build, 'icon.ico'), buildIco(images))
console.log('Scritti build/icon.png e build/icon.ico')