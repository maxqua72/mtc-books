import { NAMED_PAGE_FORMATS, PAGE_FORMATS_MM } from '@mtc/shared'

export function pdfPageOptions(pageSize: string): { format?: string; width?: string; height?: string } {
  const key = pageSize.toLowerCase()
  const size = PAGE_FORMATS_MM[key]
  return size && !NAMED_PAGE_FORMATS.includes(key)
    ? { width: `${size.width}mm`, height: `${size.height}mm` }
    : { format: pageSize }
}