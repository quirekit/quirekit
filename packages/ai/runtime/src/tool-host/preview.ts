import { commitQuireAiWrite } from "./commit";
import { createQuireAiDocumentRevision } from "./revision";
import {
  assertQuireAiExpectedRevision,
  assertQuireAiWriteAllowed,
  createQuireAiCommandContext,
  toQuireAiAuthorizationRequest
} from "./authorization";
import {
  QuireAiToolWriteError,
  type QuireAiEditPreview,
  type QuireAiToolHostOptions,
  type QuireAiToolWriteDecision,
  type QuireAiToolWriteRequest,
  type QuireAiToolWriteResult
} from "./types";

/**
 * Captures, presents, and conditionally commits one request-approval write.
 *
 * @param options - Editor authority and product Preview callback.
 * @param request - Feature-owned canonical command request.
 * @param sourceDocumentRevision - Revision captured before preflight.
 * @param initialDecision - Product policy requiring Preview.
 * @param untrackedFallback - Whether this Preview replaces a tracked write the revision system refused.
 * @returns Rejected, unchanged, or committed write result.
 */
export async function executeQuireAiPreviewWrite(
  options: QuireAiToolHostOptions,
  request: QuireAiToolWriteRequest,
  sourceDocumentRevision: string,
  initialDecision: Extract<QuireAiToolWriteDecision, { readonly allowed: true }>,
  untrackedFallback = false
): Promise<QuireAiToolWriteResult> {
  if (initialDecision.mode !== "direct" || options.requestPreview === undefined) {
    throw new QuireAiToolWriteError(
      "preview-unavailable",
      `Detached Preview is unavailable for ${request.capabilityId}.`
    );
  }
  const preview = capturePreview(options, request, sourceDocumentRevision);
  if (preview === null) return unchangedResult();

  const decision = await options.requestPreview(preview, request.signal);
  request.signal.throwIfAborted();
  if (decision === "rejected") {
    return Object.freeze({
      applied: false as const,
      receipt: null,
      reason: "rejected" as const
    });
  }
  if (decision !== "approved") {
    throw new QuireAiToolWriteError("preview-unavailable", "The review integration did not return an explicit decision.");
  }

  // Approval is not authority: every mutable gate is re-read beside final commit.
  const currentRevision = createQuireAiDocumentRevision(options.editor.state.doc);
  if (currentRevision !== sourceDocumentRevision) {
    throw new QuireAiToolWriteError(
      "stale-target",
      `Document changed while Preview awaited approval for ${request.capabilityId}.`
    );
  }
  assertQuireAiExpectedRevision(request, currentRevision);
  const finalDecision = options.authorizeWrite(toQuireAiAuthorizationRequest(request));
  assertQuireAiWriteAllowed(options, request, finalDecision);
  // The tracked policy that fell back to this Preview is unchanged when it still asks for that fallback.
  const unchangedFallback = untrackedFallback && finalDecision.mode === "tracked" && finalDecision.untrackedFallback === "preview";
  if (finalDecision.mode !== initialDecision.mode && !unchangedFallback) {
    throw new QuireAiToolWriteError(
      "permission-denied",
      `Write policy changed while Preview awaited approval for ${request.capabilityId}.`
    );
  }
  const mode = unchangedFallback ? initialDecision.mode : finalDecision.mode;
  if (!request.canApply(options.editor, mode)) {
    throw new QuireAiToolWriteError(
      "command-unavailable",
      `Command became unavailable for ${request.capabilityId}.`
    );
  }
  request.signal.throwIfAborted();
  // An approved fallback is written outside revisions; the receipt says so.
  return commitQuireAiWrite(options, request, mode, sourceDocumentRevision, untrackedFallback);
}

/**
 * Runs the canonical command under Core transaction capture without applying it.
 *
 * @param options - Canonical editor and Preview owner.
 * @param request - Exact feature command request.
 * @param sourceDocumentRevision - Revision represented by the source document.
 * @returns Detached candidate facts, or null when the command changes no document state.
 */
function capturePreview(
  options: QuireAiToolHostOptions,
  request: QuireAiToolWriteRequest,
  sourceDocumentRevision: string
): QuireAiEditPreview | null {
  const sourceDocument = options.editor.state.doc;
  const transaction = options.editor.captureTransaction(() => {
    request.apply(
      options.editor,
      createQuireAiCommandContext(options, request, "direct")
    );
  });
  if (transaction === null || transaction.doc.eq(sourceDocument)) return null;
  return Object.freeze({
    toolCallId: request.toolCallId,
    capabilityId: request.capabilityId,
    target: request.target,
    sourceDocumentRevision,
    sourceDocument,
    candidateDocument: transaction.doc,
    formatOnly: sourceDocument.textContent === transaction.doc.textContent
  });
}

/** @returns Frozen no-change result shared by detached Preview paths. */
function unchangedResult(): QuireAiToolWriteResult {
  return Object.freeze({
    applied: false as const,
    receipt: null,
    reason: "unchanged" as const
  });
}
