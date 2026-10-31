import { mapQuireAiSourcePosThrough } from "../changes/map";
import type { QuireAiSourceBlock, QuireAiSourceChangeSet, QuireAiSourceDocument } from "../types";

/** Block identity table of one source document. */
export interface QuireAiSourceIdentity {
  /** @param blocks - Current blocks in order. @returns Their ids, kept for blocks that survived since the last assignment. */
  assign(blocks: readonly QuireAiSourceBlock[]): readonly string[];
  /** @param id - Block id. @returns Whether this table issued it. */
  issued(id: string): boolean;
  /** Stops following the document. */
  destroy(): void;
}

/** Last known span of an issued id. */
interface Entry {
  /** Block start. */
  readonly from: number;
  /** End of the block's own source. */
  readonly to: number;
  /** Block kind. */
  readonly kind: string;
}

/**
 * Keeps block ids stable across reads.
 *
 * Every text change since the last assignment is kept as a change set; assigning maps each
 * known block through them. A block keeps its id when its mapped start is still the start of a
 * block of the same kind and its content did not collapse: edits inside keep the id, a replaced
 * or deleted block loses it. Typing only records the change set, so input does no block work.
 *
 * @param document - Source document port.
 * @returns Identity table.
 */
export function createQuireAiSourceIdentity(document: QuireAiSourceDocument): QuireAiSourceIdentity {
  let entries = new Map<string, Entry>();
  const issued = new Set<string>();
  let pending: QuireAiSourceChangeSet[] = [];
  let next = 1;
  const unsubscribe = document.subscribe(transaction => {
    if (transaction.changes.length > 0 && entries.size > 0) pending.push(transaction.changes);
  });
  return {
    assign(blocks) {
      const starts = new Map<number, QuireAiSourceBlock>();
      for (const block of blocks) if (!starts.has(block.from)) starts.set(block.from, block);
      // Mapped survivors, keyed by their current start; the first claim of a start wins.
      const survivors = new Map<number, string>();
      for (const [id, entry] of entries) {
        const from = mapQuireAiSourcePosThrough(pending, entry.from, 1);
        const to = mapQuireAiSourcePosThrough(pending, entry.to, -1);
        const block = starts.get(from);
        if (block === undefined || block.kind !== entry.kind || to <= from || to > block.end || survivors.has(from)) continue;
        survivors.set(from, id);
      }
      pending = [];
      const assigned = new Map<string, Entry>();
      const ids = blocks.map(block => {
        const kept = survivors.get(block.from);
        const id = kept !== undefined && !assigned.has(kept) ? kept : `b${next++}`;
        assigned.set(id, { from: block.from, to: block.to, kind: block.kind });
        issued.add(id);
        return id;
      });
      entries = assigned;
      return ids;
    },
    issued: id => issued.has(id),
    destroy() {
      unsubscribe();
      entries.clear();
      pending = [];
    }
  };
}
