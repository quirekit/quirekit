import { isHistoryTransaction, Plugin, PluginKey, type Node, type Transaction } from "@quirekit/pm";
import { readMindMapNode } from "./source";

/** Key of the plugin below; collaboration declares it a client-side plugin. */
export const mindMapRevisionKey = new PluginKey("mindMapRevision");

/**
 * Keeps a mind map's revision one above the map it replaces when undo or redo
 * restores an older map whole. Every write of a map then advances its
 * revision, as collaboration's version check of whole objects expects; the
 * commands that save a map already do.
 *
 * @returns Plugin.
 */
export function createMindMapRevisionPlugin(): Plugin {
  return new Plugin({
    key: mindMapRevisionKey,
    appendTransaction(transactions, oldState, newState) {
      if (!transactions.some((transaction) => transaction.docChanged && isHistoryTransaction(transaction))) return null;
      const before = new Map<string, { readonly mind: unknown; readonly revision: number }>();
      oldState.doc.descendants((node) => {
        const mind = node.type.name === "mindMap" ? readMindMapNode(node) : null;
        if (mind !== null) before.set(mind.id, { mind: node.attrs.mind, revision: mind.document.revision });
        return true;
      });
      let fix: Transaction | null = null;
      newState.doc.descendants((node: Node, pos: number) => {
        const mind = node.type.name === "mindMap" ? readMindMapNode(node) : null;
        const was = mind === null ? undefined : before.get(mind.id);
        if (mind === null || was === undefined || was.mind === node.attrs.mind || mind.document.revision === was.revision + 1) return true;
        fix = (fix ?? newState.tr).setNodeMarkup(pos, undefined, { ...node.attrs, mind: { ...mind, document: { ...mind.document, revision: was.revision + 1 } } });
        return true;
      });
      return fix;
    }
  });
}
