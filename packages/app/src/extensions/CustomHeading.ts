import Heading, { type HeadingOptions } from '@tiptap/extension-heading'

/** Livello HTML del titolo → livello nell'indice: Titolo 1, 2 e 3 sono h2, h3 e h4 */
export const TOC_LEVELS: Record<number, string> = { 2: '1', 3: '2', 4: '3' }

export const CustomHeading = Heading.extend({
  addOptions(): HeadingOptions {
    return {
      levels: [2, 3, 4],
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      'toc-level': {
        default: null,
        parseHTML: element => {
          return element.getAttribute('data-toc-level') || 
                 (TOC_LEVELS[Number(element.tagName.slice(1))] ?? null)
        },
        renderHTML: attributes => {
          const level = attributes['toc-level'] || 
                        (TOC_LEVELS[attributes.level] ?? null)
          
          if (!level) return {}
          return { 'data-toc-level': level }
        },
      },
    }
  },
})