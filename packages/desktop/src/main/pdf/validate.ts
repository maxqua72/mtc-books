import type { BookPdfRequest, ChapterPdfRequest, ExportSection } from '@mtc/shared'

const SAFE_ID = /^[\w.-]{1,80}$/
const TYPES = new Set(['cover', 'index', 'chapter', 'text', 'symbols', 'games', 'players'])
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object'
const isStr = (x: unknown): x is string => typeof x === 'string'
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 1)
const size = (x: unknown) => (isStr(x) ? x : 'a4')

export function parseChapter(x: unknown): ChapterPdfRequest | null {
  if (!isObj(x) || !isStr(x.htmlContent) || !isStr(x.customCss) || !isStr(x.title)) return null
  return { htmlContent: x.htmlContent, customCss: x.customCss, title: x.title, chapterNumber: num(x.chapterNumber), pageSize: size(x.pageSize), outerPageNumbers: x.outerPageNumbers === true }
}

export function parseBook(x: unknown): BookPdfRequest | null {
  if (!isObj(x) || !Array.isArray(x.sections) || x.sections.length === 0) return null
  if (!isStr(x.customCss) || !isStr(x.bookTitle)) return null
  const sections: ExportSection[] = []
  for (const s of x.sections) {
    if (!isObj(s) || !isStr(s.id) || !SAFE_ID.test(s.id) || !isStr(s.type) || !TYPES.has(s.type)) return null
    if (!isStr(s.title) || !isStr(s.html)) return null
    sections.push({ id: s.id, title: s.title, type: s.type, html: s.html, chapterNumber: num(s.chapterNumber) })
  }
  return { sections, customCss: x.customCss, bookTitle: x.bookTitle, pageSize: size(x.pageSize), outerPageNumbers: x.outerPageNumbers === true }
}