import Heading, { type HeadingOptions } from '@tiptap/extension-heading'

export const CustomHeading = Heading.extend({
  addOptions(): HeadingOptions {
    return {
      levels: [2, 3],
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
                 (element.tagName === 'H2' ? '1' : element.tagName === 'H3' ? '2' : null)
        },
        renderHTML: attributes => {
          const level = attributes['toc-level'] || 
                        (attributes.level === 2 ? '1' : attributes.level === 3 ? '2' : null)
          
          if (!level) return {}
          return { 'data-toc-level': level }
        },
      },
    }
  },
})