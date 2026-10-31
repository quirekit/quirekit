import { applyQuireAiSourceChanges, invertQuireAiSourceChanges, mapQuireAiSourcePosThrough, normalizeQuireAiSourceChanges } from "../changes/map";
import type { QuireAiSourceChangeSet, QuireAiSourceDescribedChange, QuireAiSourceDocument, QuireAiSourceStep } from "../types";

/** One transaction since a request started recording: its own to take back, or a later change to map through. */
interface RecordItem {
  /** Text changes of the transaction. */
  readonly changes: QuireAiSourceChangeSet;
  /** For the request's own transactions: what to take back. */
  readonly own?: {
    /** Text each change removed. */
    readonly removed: readonly string[];
    /** Inverse of non-text state effects. */
    readonly inverse: unknown;
    /** Non-text changes for the review. */
    readonly described: readonly QuireAiSourceDescribedChange[];
  } | undefined;
}

/** Pending AI changes of the requests awaiting review, in current coordinates. */
export interface QuireAiSourcePendingChanges {
  /** Text the AI inserted that is still in the document. */
  readonly inserted: readonly { readonly from: number; readonly to: number }[];
  /** Text the AI removed, shown at the position it was removed from. */
  readonly removed: readonly { readonly pos: number; readonly text: string }[];
}

/** Records what requests wrote, to review and take it back. */
export interface QuireAiSourceRecorder {
  /** @param requestId - Request whose writes from now on are recorded. */
  start(requestId: string): void;
  /** @param requestId - Request. @returns Whether it wrote anything recorded. */
  has(requestId: string): boolean;
  /** @param requestId - Request. @returns Steps taking its writes back from the current document. */
  revert(requestId: string): readonly QuireAiSourceStep[];
  /** @param requestId - Request. @returns Its non-text changes, for the review. */
  described(requestId: string): readonly QuireAiSourceDescribedChange[];
  /** @returns Pending changes of every recorded request. */
  pending(): QuireAiSourcePendingChanges;
  /** @param listener - Called when the AI writes or a request's record is dropped. @returns Unsubscribes. */
  subscribe(listener: () => void): () => void;
  /** @param requestId - Request whose record is dropped, after approval or rejection. */
  forget(requestId: string): void;
  /** Stops following the document. */
  destroy(): void;
}

/**
 * Creates the recorder.
 *
 * From a request's first recorded write on, every transaction is kept in order: the request's
 * own with what it removed, every other one as changes to map through. Taking a request back
 * inverts its own transactions from the last to the first and maps each inverse through
 * everything after it, as an undo history rebases over later changes; text others wrote in
 * between is kept.
 *
 * @param document - Source document port.
 * @returns Recorder.
 */
export function createQuireAiSourceRecorder(document: QuireAiSourceDocument): QuireAiSourceRecorder {
  const records = new Map<string, RecordItem[]>();
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const unsubscribe = document.subscribe(transaction => {
    // A transaction that changes no text moves nothing, unless it is a request's own state write.
    if (records.size === 0 || (transaction.changes.length === 0 && transaction.agent === null)) return;
    for (const [requestId, items] of records) {
      const own = transaction.agent?.requestId === requestId;
      items.push({
        changes: transaction.changes,
        ...(own ? { own: { removed: transaction.removed, inverse: transaction.inverse, described: transaction.described ?? [] } } : {})
      });
    }
    // Highlights map through other edits by themselves; only the AI's own writes change what is pending.
    if (transaction.agent !== null) notify();
  });
  /** @param items - Record. @returns Inverse steps, last own transaction first. */
  const invert = (items: readonly RecordItem[]): QuireAiSourceStep[] => {
    const steps: QuireAiSourceStep[] = [];
    const applied: QuireAiSourceChangeSet[] = [];
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index]!;
      if (item.own === undefined) continue;
      const later = [...items.slice(index + 1).map(entry => entry.changes), ...applied];
      const mapped = invertQuireAiSourceChanges(item.changes, item.own.removed).map(change => {
        const from = mapQuireAiSourcePosThrough(later, change.from, 1);
        return { from, to: Math.max(from, mapQuireAiSourcePosThrough(later, change.to, -1)), insert: change.insert };
      });
      const changes = normalizeQuireAiSourceChanges(mapped) ?? [];
      if (changes.length > 0) {
        steps.push({ kind: "changes", changes });
        applied.push(changes);
      }
      if (item.own.inverse !== undefined) steps.push({ kind: "state", inverse: item.own.inverse });
    }
    return steps;
  };
  return {
    start(requestId) {
      if (!records.has(requestId)) records.set(requestId, []);
    },
    has: requestId => records.get(requestId)?.some(item => item.own !== undefined) === true,
    revert: requestId => invert(records.get(requestId) ?? []),
    described: requestId => (records.get(requestId) ?? []).flatMap(item => item.own?.described ?? []),
    pending() {
      const inserted: { from: number; to: number }[] = [];
      const removed: { pos: number; text: string }[] = [];
      for (const items of records.values()) {
        items.forEach((item, index) => {
          if (item.own === undefined) return;
          const later = items.slice(index + 1).map(entry => entry.changes);
          invertQuireAiSourceChanges(item.changes, item.own.removed).forEach(change => {
            const from = mapQuireAiSourcePosThrough(later, change.from, 1);
            const to = mapQuireAiSourcePosThrough(later, change.to, -1);
            if (to > from) inserted.push({ from, to });
            if (change.insert !== "") removed.push({ pos: mapQuireAiSourcePosThrough(later, change.from, -1), text: change.insert });
          });
        });
      }
      return { inserted, removed };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    forget(requestId) {
      if (records.delete(requestId)) notify();
    },
    destroy() {
      unsubscribe();
      records.clear();
      listeners.clear();
    }
  };
}

/**
 * Applies the text changes of steps to a text, leaving out state steps.
 * @param text - Starting text.
 * @param steps - Steps in order.
 * @returns Resulting text.
 */
export function applyQuireAiSourceTextSteps(text: string, steps: readonly QuireAiSourceStep[]): string {
  return steps.reduce((result, step) => step.kind === "changes" ? applyQuireAiSourceChanges(result, step.changes) : result, text);
}

