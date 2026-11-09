import { isHistoryTransaction, Plugin, PluginKey, type Node, type Transaction } from "@quirekit/pm";
import { readWhiteboardNode } from "./source";

/** Key of the plugin below; collaboration declares it a client-side plugin. */
export const whiteboardRevisionKey = new PluginKey("whiteboardRevision");

/**
 * Keeps a board's revision one above the board it replaces when undo or redo
 * restores an older board whole. Every write of a board then advances its
 * revision, as collaboration's version check of whole objects expects; the
 * commands that save a board already do.
 *
 * @returns Plugin.
 */
export function createWhiteboardRevisionPlugin(): Plugin {
  return new Plugin({
    key: whiteboardRevisionKey,
    appendTransaction(transactions, oldState, newState) {
      if (!transactions.some((transaction) => transaction.docChanged && isHistoryTransaction(transaction))) return null;
      const before = new Map<string, { readonly board: unknown; readonly revision: number }>();
      oldState.doc.descendants((node) => {
        const board = node.type.name === "whiteboard" ? readWhiteboardNode(node) : null;
        if (board !== null) before.set(board.id, { board: node.attrs.board, revision: board.revision });
        return true;
      });
      let fix: Transaction | null = null;
      newState.doc.descendants((node: Node, pos: number) => {
        const board = node.type.name === "whiteboard" ? readWhiteboardNode(node) : null;
        const was = board === null ? undefined : before.get(board.id);
        if (board === null || was === undefined || was.board === node.attrs.board || board.revision === was.revision + 1) return true;
        fix = (fix ?? newState.tr).setNodeMarkup(pos, undefined, { ...node.attrs, board: { ...board, revision: was.revision + 1 } });
        return true;
      });
      return fix;
    }
  });
}
