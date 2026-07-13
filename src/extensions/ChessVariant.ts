

import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';

export const ChessVariant = TiptapNode.create({
  name: 'chessVariant',

  group: 'inline',
  content: 'inline*', // Può contenere mosse (chessMove) e testo di commento inline
  inline: true,

  parseHTML() {
    return [
      { tag: 'span.chess-variant' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'chess-variant text-sm text-gray-600 italic before:content-["("] after:content-[")"] print:text-gray-700 mx-1'
      }),
      0 // Rappresenta la posizione del contenuto inserito all'interno del tag
    ];
  }
});