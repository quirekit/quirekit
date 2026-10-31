import type { QuireEditor, QuireEditorTransactionEvent } from "@quirekit/core";
import { Mapping } from "@quirekit/pm";
import { locateInReplacedContainer } from "./identity-replaced";
import type { QuireAiBlockEntry, QuireAiBlockIdentity } from "./types";

/** Steps followed before identities are dropped instead of mapped; bounds memory for long edit sessions. */
const maximumMappedSteps = 20_000;

/**
 * Creates block identities that survive edits between reads.
 *
 * Transactions only append their step maps, so typing costs no per-block work.
 * Positions are mapped lazily when identities are assigned or resolved.
 *
 * @param editor - Editor whose transactions are followed.
 * @returns Identity table for model-visible block ids.
 */
export function createQuireAiBlockIdentity(editor: QuireEditor): QuireAiBlockIdentity {
  let blocks = new Map<string, QuireAiBlockEntry>();
  let mapping = new Mapping();
  // Document the recorded positions refer to, for blocks inside a container replaced as a whole.
  let snapshot = editor.state.doc;
  let counter = 0;
  const onTransaction = (event: QuireEditorTransactionEvent) => {
    if (blocks.size === 0) return;
    for (const transaction of [event.transaction, ...event.appendedTransactions]) {
      if (transaction.docChanged) mapping.appendMapping(transaction.mapping);
    }
    if (mapping.maps.length > maximumMappedSteps) { blocks = new Map(); mapping = new Mapping(); snapshot = editor.state.doc; }
  };
  editor.on("transaction", onTransaction);

  /**
   * Maps one recorded block to the current document.
   *
   * Both ends are mapped: attribute changes replace the opening token, so the
   * start alone cannot tell an edited block from a deleted one. The block survives
   * when a node of the same type spans exactly the mapped range, or when a container
   * holding it was replaced by one of the same shape.
   *
   * @param entry - Block recorded at the last assignment.
   * @returns Current position, or null when the block was deleted or replaced by another kind.
   */
  function locate(entry: QuireAiBlockEntry): number | null {
    const doc = editor.state.doc;
    const start = mapping.map(entry.pos, 1);
    const end = mapping.map(entry.pos + entry.size, -1);
    const node = doc.nodeAt(start);
    if (node?.type.name === entry.type && start + node.nodeSize === end) return start;
    return locateInReplacedContainer(snapshot, doc, mapping, entry.pos, entry.type);
  }

  return {
    assign(entries) {
      const byPosition = new Map<number, string>();
      for (const [id, entry] of blocks) {
        const pos = locate(entry);
        if (pos !== null && !byPosition.has(pos)) byPosition.set(pos, id);
      }
      const next = new Map<string, QuireAiBlockEntry>();
      const ids = entries.map(entry => {
        const id = byPosition.get(entry.pos) ?? `b${counter += 1}`;
        next.set(id, entry);
        return id;
      });
      blocks = next;
      mapping = new Mapping();
      snapshot = editor.state.doc;
      return ids;
    },
    resolve(id) {
      const entry = blocks.get(id);
      return entry === undefined ? null : locate(entry);
    },
    issued(id) {
      const number = /^b([1-9]\d*)$/u.exec(id)?.[1];
      return number !== undefined && Number(number) <= counter;
    },
    destroy() {
      editor.off("transaction", onTransaction);
      blocks.clear();
    }
  };
}
