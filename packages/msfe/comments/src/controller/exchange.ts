import { hashCommentSource } from "../anchoring/hash";
import { createCommentAnchor } from "../anchoring/quote";
import { resolveCommentAnchor } from "../anchoring/resolve";
import { validateCommentsExchange } from "../protocol/validate";
import type { CommentsExchange, CommentsIssue, CommentThread } from "../protocol/types";
import type { CommentPlacement, CommentsState } from "../state/types";

/** Validated import, resolved against one source text. */
export type PreparedImport =
  | {
    /** Valid data. */
    readonly ok: true;
    /** Threads in document order of the exchange. */
    readonly threads: readonly CommentThread[];
    /** Ranges for every placed thread. */
    readonly placements: readonly CommentPlacement[];
    /** Placed elsewhere than the stored hint. */
    readonly moved: readonly string[];
    /** Not placed. */
    readonly orphaned: readonly string[];
  }
  | {
    /** Invalid data. */
    readonly ok: false;
    /** Every validation issue. */
    readonly issues: readonly CommentsIssue[];
  };

/**
 * Validates exchange data and places every anchor on the given source; the source hash is computed once.
 * @param value - Untrusted parsed JSON.
 * @param source - Canonical editor text (line breaks normalized to LF).
 * @returns Threads with placements, or validation issues.
 */
export function prepareImport(value: unknown, source: string): PreparedImport {
  const validation = validateCommentsExchange(value);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  const hash = hashCommentSource(source), placements: CommentPlacement[] = [], moved: string[] = [], orphaned: string[] = [];
  for (const thread of validation.value.threads) {
    // Document comments have no position to resolve and are never orphaned.
    if (!thread.anchor) continue;
    const result = resolveCommentAnchor(source, thread.anchor, hash);
    if (result.status === "orphaned") { orphaned.push(thread.id); continue; }
    placements.push({ id: thread.id, ...result.range });
    if (result.range.from !== thread.anchor.hint.from || result.range.to !== thread.anchor.hint.to) moved.push(thread.id);
  }
  return { ok: true, threads: validation.value.threads, placements, moved, orphaned };
}

/**
 * Builds the exchange document for the current source. Placed threads get fresh anchors;
 * orphaned threads and those whose quoted text was deleted keep their last good anchor,
 * so a later import reports them as orphaned with the original quote instead of as a bare point.
 * Document comments keep no anchor; version 2 is written only when one exists, so other data stays readable as version 1.
 * @param state - Current comment state.
 * @param source - Canonical editor text.
 * @returns Exchange document.
 */
export function buildExport(state: CommentsState, source: string): CommentsExchange {
  const hash = hashCommentSource(source);
  const ranges = new Map(state.ranges.all().map(range => [range.id, range]));
  const threads = [...state.threads.values()].map(thread => {
    const range = ranges.get(thread.id);
    if (!thread.anchor || !range || range.from === range.to && thread.anchor.quote.exact.length) return thread;
    // Collaboration endpoints are not carried over; the collaboration binding writes its own.
    try { return { ...thread, anchor: createCommentAnchor(source, range, hash) }; } catch { return thread; }
  });
  return { format: "quirekit.comments", version: threads.some(thread => !thread.anchor) ? 2 : 1, source: { hash }, threads };
}
