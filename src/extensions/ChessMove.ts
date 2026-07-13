import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { useChessTreeStore } from '../stores/chessTreeStore';

export const ChessMove = Node.create({
  name: 'chessMove',

  group: 'inline',
  inline: true,
  selectable: true,
  atom: true, // Protezione da scrittura/modifica tastiera

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-move-id'),
        renderHTML: attributes => ({ 'data-move-id': attributes.id }),
      },
      san: {
        default: '',
        parseHTML: element => element.getAttribute('data-san'),
        renderHTML: attributes => ({ 'data-san': attributes.san }),
      },
      color: {
        default: 'w',
        parseHTML: element => element.getAttribute('data-color'),
        renderHTML: attributes => ({ 'data-color': attributes.color }),
      },
      moveNumber: {
        default: 1,
        parseHTML: element => element.getAttribute('data-move-number'),
        renderHTML: attributes => ({ 'data-move-number': attributes.moveNumber }),
      }
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-move-id]' },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    // Risolto errore 1: si usa node.attrs
    const { san, color, moveNumber } = node.attrs;
    
    const formatWithFigurine = (sanText: string): string => {
      const replacements: Record<string, string> = {
        'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘'
      };
      const firstChar = sanText.charAt(0);
      if (replacements[firstChar]) {
        return replacements[firstChar] + sanText.slice(1);
      }
      return sanText;
    };

    const formattedMove = formatWithFigurine(san);
    const prefix = color === 'w' ? `${moveNumber}.` : `${moveNumber}...`;
    
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'chess-move inline-block mx-0.5 px-1 font-medium text-blue-700 bg-blue-50 rounded cursor-pointer hover:bg-blue-100 print:text-black print:bg-transparent select-all',
        contenteditable: 'false'
      }),
      `${prefix} ${formattedMove}`
    ];
  },

  // Risolti errori 2, 3, 4: Gestione eventi standard tramite plugin ProseMirror con tipi espliciti
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('chessMoveClick'),
        props: {
          handleClick(view: EditorView, pos: number, event: MouseEvent) {
            const target = event.target as HTMLElement;
            const moveSpan = target.closest('.chess-move');
            
            if (moveSpan) {
              const moveId = moveSpan.getAttribute('data-move-id');
              if (moveId) {
                const treeStore = useChessTreeStore();
                treeStore.setActiveNode(moveId);
                return true;
              }
            }
            return false;
          }
        }
      })
    ];
  }
});