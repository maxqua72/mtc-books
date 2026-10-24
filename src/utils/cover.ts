// Modello, stile e generazione HTML della copertina
import { newUuid } from './ids'
import { escapeHtml } from './html'

// Formati pagina: unica fonte in pageFormats.ts (qui ri-esportati per chi già li importa da cover)
export { PAGE_FORMATS_MM, getPageSizeMm, MM_TO_PX } from './pageFormats'

export type CoverFontKey = 'lora' | 'garamond' | 'sans'

export const COVER_FONTS: Record<CoverFontKey, { label: string; css: string }> = {
    lora: { label: 'Lora', css: "'Lora', Georgia, serif" },
    garamond: { label: 'EB Garamond', css: "'EB Garamond', Georgia, serif" },
    sans: { label: 'Sans', css: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
}

export interface CoverTextElement {
    id: string
    text: string                       // testo semplice, con \n per andare a capo
    x: number                          // % della larghezza pagina (bordo sinistro)
    y: number                          // % dell'altezza pagina (bordo superiore)
    width: number                      // % della larghezza pagina
    fontFamily: CoverFontKey
    fontSize: number                   // pt
    bold: boolean
    italic: boolean
    align: 'left' | 'center' | 'right'
    color: string                      // #rrggbb
}

export interface CoverImage {
    assetId: string                    // riferimento all'immagine salvata a parte
    x: number                          // punto focale, 0-100
    y: number
    zoom: number                       // 1 = riempie la pagina
}

export interface BookCover {
    version: 1
    image: CoverImage | null
    texts: CoverTextElement[]
}

// --- Immagini di copertina ---
export const COVER_EXT_BY_MIME: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'
}
export const COVER_MIME_BY_EXT: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp'
}
export const MAX_COVER_IMAGE_BYTES = 25 * 1024 * 1024

// --- Creazione ---
export const newCoverId = (prefix = 'ct') => newUuid(prefix)

export const createEmptyCover = (): BookCover => ({ version: 1, image: null, texts: [] })

export const createCoverText = (partial: Partial<CoverTextElement> = {}): CoverTextElement => ({
    id: newCoverId(),
    text: 'Testo',
    x: 10,
    y: 10,
    width: 80,
    fontFamily: 'lora',
    fontSize: 28,
    bold: false,
    italic: false,
    align: 'center',
    color: '#111111',
    ...partial,
})

// --- Convalida dei dati (anche quelli provenienti da un .mtcbook) ---
const num = (v: unknown, def: number, min: number, max: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : def
    return Math.min(max, Math.max(min, n))
}
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
const isAssetId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v)

export function normalizeCover(raw: any): BookCover {
    if (!raw || typeof raw !== 'object') return createEmptyCover()

    const image: CoverImage | null = raw.image && isAssetId(raw.image.assetId)
        ? {
            assetId: raw.image.assetId,
            x: num(raw.image.x, 50, 0, 100),
            y: num(raw.image.y, 50, 0, 100),
            zoom: num(raw.image.zoom, 1, 1, 5),
        }
        : null

    const texts: CoverTextElement[] = Array.isArray(raw.texts)
        ? raw.texts.slice(0, 50).map((t: any): CoverTextElement => ({
            id: typeof t?.id === 'string' && /^[\w-]{1,80}$/.test(t.id) ? t.id : newCoverId(),
            text: String(t?.text ?? '').slice(0, 2000),
            x: num(t?.x, 10, 0, 100),
            y: num(t?.y, 10, 0, 100),
            width: num(t?.width, 80, 5, 100),
            fontFamily: t?.fontFamily in COVER_FONTS ? t.fontFamily : 'lora',
            fontSize: num(t?.fontSize, 28, 4, 300),
            bold: !!t?.bold,
            italic: !!t?.italic,
            align: ['left', 'center', 'right'].includes(t?.align) ? t.align : 'center',
            color: isHex(t?.color) ? t.color : '#111111',
        }))
        : []

    return { version: 1, image, texts }
}

// --- Stili condivisi tra editor (Vue) ed esportazione (stringa HTML) ---
export type StyleMap = Record<string, string>

export const coverTextStyle = (t: CoverTextElement): StyleMap => ({
    position: 'absolute',
    left: `${t.x}%`,
    top: `${t.y}%`,
    width: `${t.width}%`,
    margin: '0',
    fontFamily: COVER_FONTS[t.fontFamily]?.css ?? COVER_FONTS.lora.css,
    fontSize: `${t.fontSize}pt`,
    fontWeight: t.bold ? '700' : '400',
    fontStyle: t.italic ? 'italic' : 'normal',
    textAlign: t.align,
    color: isHex(t.color) ? t.color : '#111111',
    lineHeight: '1.2',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    boxSizing: 'border-box',
})

export const coverImageStyle = (img: CoverImage): StyleMap => ({
    position: 'absolute',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    objectFit: 'cover',
    objectPosition: `${img.x}% ${img.y}%`,
    transformOrigin: `${img.x}% ${img.y}%`,
    transform: `scale(${img.zoom})`,
})

// --- HTML per l'esportazione PDF ---
const kebab = (k: string) => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
export const styleToString = (s: StyleMap) =>
    Object.entries(s).map(([k, v]) => `${kebab(k)}:${v}`).join(';')

/**
 * @param imageSrc data URL (o URL) dell'immagine di sfondo, già risolto dal chiamante
 */
export function coverToHtml(
    cover: BookCover,
    imageSrc: string | null,
    pageMm: { width: number; height: number }
): string {
    const sectionStyle = styleToString({
        width: `${pageMm.width}mm`,
    })
    // Mezzo pixel in meno: evita che un arrotondamento generi una seconda pagina vuota
    const pageStyle = styleToString({
        position: 'relative',
        width: `${pageMm.width}mm`,
        height: `calc(${pageMm.height}mm - 0.5px)`,
        overflow: 'hidden',
        background: '#ffffff',
    })

    const image = cover.image && imageSrc
        ? `<img class="cover-image" alt="" src="${escapeHtml(imageSrc)}" style="${escapeHtml(styleToString(coverImageStyle(cover.image)))}">`
        : ''

    const texts = cover.texts
        .map(t => `<div class="cover-text" style="${escapeHtml(styleToString(coverTextStyle(t)))}">${escapeHtml(t.text)}</div>`)
        .join('')

    return `<div class="cover-section" style="${sectionStyle}"><div class="cover-page" style="${pageStyle}">${image}${texts}</div></div>`
}

// Utile in fase di esportazione: da Blob a data URL
export const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
    })