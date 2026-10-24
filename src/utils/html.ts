// Piccole utilità HTML condivise

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// tree-id (nodi legacy) o data-tree-id (Tiptap): i valori sono sempre tra doppi apici
const TREE_ID_RE = /\b(?:data-)?tree-id="([^"]*)"/g

/** Id degli alberi referenziati da un HTML di capitolo, senza doppioni. Niente DOMParser: gira anche nel percorso caldo del salvataggio. */
export function extractTreeIds(html: string): string[] {
  if (!html) return []
  const ids = new Set<string>()
  for (const m of html.matchAll(TREE_ID_RE)) if (m[1]) ids.add(m[1])
  return [...ids]
}
