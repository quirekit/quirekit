import { getChangedRanges, readQuireTransactionOrigin } from "@quirekit/core";
import { Mapping, Plugin, PluginKey, TextSelection, type Node, type Transaction } from "@quirekit/pm";
import { resolveWordNumberingRegistry } from "@quirekit/classic-numbering-model";
import { flattenList, isListContainer } from "./flatten";

/**
 * Migrates compatible roots atomically, preserving paragraph offsets and resources.
 * @param tr - Existing transaction, including initial admission.
 * @param ranges - Changed ranges in the final document; omitted only during initial admission.
 * @returns Whether any wrapper was converted.
 */
export function normalizeListContainers(tr: Transaction, ranges?: readonly { from: number; to: number }[]): boolean {
  const roots = new Map<number, Node>();
  for (const range of ranges ?? [{ from: 0, to: tr.doc.content.size }]) {
    tr.doc.nodesBetween(range.from, range.to, (node, position) => {
      if (isListContainer(node)) { roots.set(position, node); return false; }
      return !node.isTextblock;
    });
  }
  if (!roots.size) return false;
  let registry = resolveWordNumberingRegistry(tr.doc.attrs.wordNumberingRegistry), changed = false;
  let anchor = tr.selection.anchor, head = tr.selection.head;
  for (const [position, node] of [...roots].sort(([a], [b]) => b - a)) {
    const converted = flattenList(node, registry);
    if (!converted) continue;
    const positions = converted.positions;
    const from = position, to = position + node.nodeSize;
    const size = converted.nodes.reduce((sum, child) => sum + child.nodeSize, 0);
    /** @param endpoint - Old canonical endpoint. @returns Exact paragraph-relative position or mapped boundary. */
    function mapEndpoint(endpoint: number): number {
      if (endpoint < from) return endpoint;
      if (endpoint >= to) return endpoint + size - node.nodeSize;
      const part = positions.find(part => endpoint > from + part.before && endpoint < from + part.before + part.size);
      return part ? from + part.after + endpoint - from - part.before : from + 1;
    }
    anchor = mapEndpoint(anchor); head = mapEndpoint(head);
    tr.replaceWith(from, to, converted.nodes);
    registry = converted.registry; changed = true;
  }
  if (changed) {
    tr.setDocAttribute("wordNumberingRegistry", registry);
    if (tr.selection instanceof TextSelection) tr.setSelection(TextSelection.create(tr.doc, anchor, head));
  }
  return changed;
}

/** Key of the plugin below; collaboration declares it a client-side plugin. */
const blockListMigrationKey = new PluginKey("blockListMigration");

/** @returns Legacy JSON/HTML paste migration appended to the initiating history event. */
export function createListMigrationPlugin(): Plugin {
  return new Plugin({
    key: blockListMigrationKey,
    /** @param transactions - Accepted root changes. @param _old - Prior state. @param state - Latest state. @returns One migration or null. */
    appendTransaction(transactions, _old, state) {
      if (transactions.some(transaction => readQuireTransactionOrigin(transaction) === "collaboration")) return null;
      // Project every actual change through later appended maps before examining its roots.
      // Ordinary typing cannot trigger a scan of unrelated legacy lists elsewhere in the document.
      const ranges = transactions.flatMap((transaction, index) => {
        if (!transaction.docChanged) return [];
        const mapping = new Mapping(transactions.slice(index + 1).flatMap(next => next.mapping.maps));
        return getChangedRanges(transaction).map(({ newRange }) => ({
          from: mapping.map(newRange.from, -1), to: mapping.map(newRange.to, 1)
        }));
      });
      if (!ranges.length) return null;
      const tr = state.tr;
      return normalizeListContainers(tr, ranges) ? tr : null;
    }
  });
}
