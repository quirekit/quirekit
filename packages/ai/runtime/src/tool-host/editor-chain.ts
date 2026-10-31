import {
  QUIRE_TRANSACTION_ORIGIN_META_KEY,
  type QuireEditor
} from "@quirekit/core";
import type { QuireAiToolWriteContext } from "./types";

const WORD_REVISION_TRANSACTION_META_KEY = "quirekit:word-revision";

/**
 * Starts the canonical editor chain with exact AI write provenance.
 *
 * This helper only sets transaction metadata on the existing editor chain. It
 * does not select, wrap, dispatch, or reimplement any editor command.
 *
 * @param editor - Canonical mounted editor.
 * @param context - Host-authorized direct or tracked write provenance.
 * @returns The existing editor chain ready for a feature-owned command.
 */
export function createQuireAiEditorChain(
  editor: QuireEditor,
  context: QuireAiToolWriteContext
): ReturnType<QuireEditor["chain"]> {
  const chain = editor.chain().setMeta(
    QUIRE_TRANSACTION_ORIGIN_META_KEY,
    context.mode === "tracked" ? "ai" : "direct"
  );
  if (context.mode === "direct") return chain;
  const reviewer = context.reviewer;
  if (reviewer === null) {
    throw new TypeError("Tracked AI commands require a reviewer identity.");
  }
  return chain.setMeta(WORD_REVISION_TRANSACTION_META_KEY, {
    aiTrackedApply: true,
    aiExecutionId: context.executionId ?? context.toolCallId,
    aiOperationId: context.toolCallId,
    aiReviewer: {
      reviewerId: reviewer.id,
      reviewerName: reviewer.name
    }
  });
}
