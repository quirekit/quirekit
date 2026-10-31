import type { QuireAiSourceReviews } from "@quirekit/ai-runtime/source";
import type { MsfeEditor } from "@quirekit/msfe-core";
import { setMsfeAiReview } from "./decorations";

/**
 * Keeps the editor's highlights of AI changes in step with the requests awaiting review.
 * Updates are batched after the transaction that caused them, since an editor cannot be
 * updated while it applies a transaction.
 * @param editor - Mounted editor with the MsfeAi extension.
 * @param reviews - Pending AI changes of a document SDK.
 * @returns Stops following and clears the highlights.
 */
export function attachMsfeAiReview(editor: MsfeEditor, reviews: QuireAiSourceReviews): () => void {
  let scheduled = false;
  let stopped = false;
  const unsubscribe = reviews.subscribe(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (stopped || editor.scope.disposed) return;
      const pending = reviews.pending();
      const empty = pending.inserted.length === 0 && pending.removed.length === 0;
      editor.updateViewState({ effects: [setMsfeAiReview.of(empty ? null : pending)] });
    });
  });
  return () => {
    stopped = true;
    unsubscribe();
    if (!editor.scope.disposed) editor.updateViewState({ effects: [setMsfeAiReview.of(null)] });
  };
}
