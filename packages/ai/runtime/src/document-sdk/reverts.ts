import { QUIRE_TRANSACTION_ORIGIN_META_KEY, type QuireEditor } from "@quirekit/core";
import { Mapping, Transform, type Node, type Step, type StepMap, type Transaction } from "@quirekit/pm";
import type { QuireAiDirectFallback } from "../tool-host";

/** One step since a request's first direct fallback: its own to take back, or a later change to map through. */
interface RevertItem {
  /** Position map of the step. */
  readonly map: StepMap;
  /** The step and the document it applied to, when the request review takes it back. */
  readonly own?: { readonly step: Step; readonly before: Node } | undefined;
}

/**
 * Keeps what each request wrote directly in place of tracked changes, so its review can take
 * those writes back when the user rejects the request.
 *
 * From a request's first direct fallback on, every editor step is kept in order: the request's
 * own direct steps with the document they applied to, and every other step as a position map.
 * Taking a request back inverts its own steps from the last to the first and maps each through
 * everything after it, as an undo history rebases over later changes.
 *
 * @param editor - Canonical editor.
 * @returns Recorder and the review's view and undo of it.
 */
export function createDocumentReverts(editor: QuireEditor) {
  const requests = new Map<string, RevertItem[]>();
  /** @param event - Editor transaction event. */
  const observe = ({ transaction, appendedTransactions }: { transaction: Transaction; appendedTransactions: readonly Transaction[] }) => {
    for (const tr of [transaction, ...appendedTransactions]) {
      for (const items of requests.values()) for (const map of tr.mapping.maps) items.push({ map });
    }
  };
  /** Starts or stops following editor changes as requests gain or lose direct writes. */
  const follow = () => {
    if (requests.size > 0) editor.on("transaction", observe);
    else editor.off("transaction", observe);
  };
  /**
   * @param requestId - Request whose direct writes to take back.
   * @param doc - Document to take them back from, the editor's current one or a copy of it.
   * @returns Transform holding the inverted steps that still apply, or null when the request wrote nothing directly.
   */
  const invert = (requestId: string, doc: Node): Transform | null => {
    const items = requests.get(requestId);
    if (items === undefined) return null;
    const transform = new Transform(doc);
    const remap = new Mapping(items.map(item => item.map));
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const own = items[index]!.own;
      if (own === undefined) continue;
      // Everything after this step, including the inverses already applied, which mirror their steps.
      const inverse = own.step.invert(own.before).map(remap.slice(index + 1));
      if (inverse === null || transform.maybeStep(inverse).failed !== null) continue;
      remap.appendMap(transform.mapping.maps[transform.mapping.maps.length - 1]!, index);
    }
    return transform;
  };
  return {
    /** @param fallback - Direct write made in place of a tracked one. */
    record(fallback: QuireAiDirectFallback): void {
      if (fallback.executionId === null) return;
      const own: RevertItem[] = fallback.transactions.flatMap(tr => tr.steps.map((step, index) => ({
        map: step.getMap(), own: { step, before: tr.docs[index]! }
      })));
      // While following the editor, every record already took these steps as later changes;
      // the request's own record keeps them as its own instead.
      const existing = requests.get(fallback.executionId);
      if (existing === undefined) requests.set(fallback.executionId, own);
      else existing.splice(existing.length - own.length, own.length, ...own);
      follow();
    },
    /** @param requestId - Request. @returns Whether it wrote anything directly in place of tracked changes. */
    has(requestId: string): boolean {
      return requests.has(requestId);
    },
    /**
     * @param requestId - Request.
     * @param doc - Current document or a copy of it.
     * @returns The document without the request's direct writes, or null when it made none.
     */
    without(requestId: string, doc: Node): Node | null {
      return invert(requestId, doc)?.doc ?? null;
    },
    /**
     * Takes the request's direct writes back in the editor as part of the user's rejection.
     * @param requestId - Request.
     */
    revert(requestId: string): void {
      const transform = invert(requestId, editor.state.doc);
      this.forget(requestId);
      if (transform === null || transform.steps.length === 0) return;
      editor.chain().setMeta(QUIRE_TRANSACTION_ORIGIN_META_KEY, "decision").command(({ tr }: { tr: Transaction }) => {
        for (const step of transform.steps) tr.step(step);
        return true;
      }).run();
    },
    /** @param requestId - Request whose direct writes stay, after approval or when it is reviewed no more. */
    forget(requestId: string): void {
      if (requests.delete(requestId)) follow();
    },
    /** Stops following the editor. */
    destroy(): void {
      requests.clear();
      follow();
    }
  };
}
