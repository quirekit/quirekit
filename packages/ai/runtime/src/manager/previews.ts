import type { QuireEditor } from "@quirekit/core";
import type { QuireAiPresentation, QuireAiPreviewReview, QuireAiPreviews } from "./types";

/** Preview owned by one document operation. */
interface ActivePreview {
  /** Operation that produced the preview. */
  readonly operationId: string;
  /** Recomputes the preview for the current document; null stops it. */
  readonly compute: () => QuireAiPresentation | null;
  /** Pending approval, attached once the edit awaits review. */
  review?: QuireAiPreviewReview | undefined;
}

/** Preview channel with the publishing side used by the core tools. */
export interface QuireAiPreviewChannel {
  /** Read side exposed on the manager. */
  readonly previews: QuireAiPreviews;
  /**
   * Shows an operation's preview, replacing any other.
   * @param operationId - Owning operation.
   * @param compute - Builds the preview for the current document; called again after document changes.
   */
  show(operationId: string, compute: () => QuireAiPresentation | null): void;
  /**
   * Clears the preview if this operation owns it.
   * @param operationId - Owning operation.
   */
  clear(operationId: string): void;
  /**
   * Attaches the approval port of an operation awaiting review.
   * @param operationId - Owning operation.
   * @param review - Decision port.
   */
  attachReview(operationId: string, review: QuireAiPreviewReview): void;
  /** Clears any preview. */
  clearAll(): void;
  /** Stops following the editor. */
  destroy(): void;
}

/**
 * Creates the editor's single in-document preview.
 *
 * Only one operation previews at a time. A document change between deltas
 * (user or collaborator edits) recomputes the preview so it never renders stale
 * positions; a preview that no longer plans is cleared.
 *
 * @param editor - Editor whose document the previews describe.
 * @returns Preview channel.
 */
export function createQuireAiPreviewChannel(editor: QuireEditor): QuireAiPreviewChannel {
  const listeners = new Set<(presentation: QuireAiPresentation | null) => void>();
  let active: ActivePreview | null = null;
  let current: QuireAiPresentation | null = null;

  /** @param next - Preview to publish; one equal to the current preview is skipped, so repeated deltas cost no render. */
  function publish(next: QuireAiPresentation | null): void {
    if (next === current || (next !== null && current !== null && samePresentation(next, current))) return;
    current = next;
    for (const listener of listeners) listener(next);
  }

  /** Recomputes the active preview, clearing it when it no longer plans. */
  function refresh(): void {
    if (active === null) return publish(null);
    let next: QuireAiPresentation | null;
    try { next = active.compute(); } catch { next = null; }
    if (next === null) active = null;
    publish(next === null || active?.review === undefined ? next : { ...next, review: active.review });
  }

  /** @param event - Editor transaction event. */
  function onTransaction(event: { transaction: { docChanged: boolean } }): void {
    if (active !== null && event.transaction.docChanged) refresh();
  }
  editor.on("transaction", onTransaction);

  return {
    previews: {
      get current() { return current; },
      subscribe(listener) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      }
    },
    show(operationId, compute) {
      active = { operationId, compute };
      refresh();
    },
    attachReview(operationId, review) {
      if (active?.operationId !== operationId) return;
      active.review = review;
      refresh();
    },
    clear(operationId) {
      if (active?.operationId !== operationId) return;
      active = null;
      publish(null);
    },
    clearAll() {
      active = null;
      publish(null);
    },
    destroy() {
      editor.off("transaction", onTransaction);
      active = null;
      publish(null);
      listeners.clear();
    }
  };
}

/**
 * Compares two previews by what they show.
 * @param left - Preview.
 * @param right - Preview.
 * @returns Whether both present the same steps, ranges and review on the same base document.
 */
function samePresentation(left: QuireAiPresentation, right: QuireAiPresentation): boolean {
  return left.baseDoc === right.baseDoc
    && left.review === right.review
    && left.steps.length === right.steps.length
    && left.ranges.length === right.ranges.length
    && left.ranges.every((range, index) => {
      const other = right.ranges[index]!;
      return range.from === other.from && range.to === other.to && range.role === other.role;
    })
    && left.steps.every((step, index) => JSON.stringify(step.toJSON()) === JSON.stringify(right.steps[index]!.toJSON()));
}
