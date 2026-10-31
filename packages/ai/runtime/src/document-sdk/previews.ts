import type { Node } from "@quirekit/pm";
import { v4 as uuidv4 } from "uuid";
import type { QuireAiEditPreview, QuireAiEditPreviewDecision } from "../tool-host";
import { copyDocumentJson } from "./json";
import { QuireDocumentSdkError } from "./error";
import type { createDocumentReverts } from "./reverts";
import type { QuireDocumentChange, QuireDocumentEvent, QuireDocumentSdkOptions } from "./types";

/**
 * Owns serialized review candidates and releases decisions on cancellation.
 * @param options - Document identity and optional review integration.
 * @param emit - Isolated fact publisher.
 * @param reverts - Direct writes requests made in place of tracked changes.
 * @returns Review requester and decision port.
 */
export function createDocumentPreviews(options: QuireDocumentSdkOptions, emit: (event: QuireDocumentEvent) => void,
  reverts: ReturnType<typeof createDocumentReverts>) {
  const pending = new Map<string, (decision: QuireAiEditPreviewDecision | "cancelled") => void>();
  /**
   * @param source - Document before the edit.
   * @param candidate - Document after the edit.
   * @returns Readable descriptions and changes; each is left out when the owner supplies no describer or it fails.
   */
  const describe = (source: Node, candidate: Node): { sourceView?: string; candidateView?: string; changes?: readonly QuireDocumentChange[] } => {
    const result: { sourceView?: string; candidateView?: string; changes?: readonly QuireDocumentChange[] } = {};
    try {
      if (options.describeDocument !== undefined) {
        result.sourceView = options.describeDocument(source);
        result.candidateView = options.describeDocument(candidate);
      }
    } catch { /* The review still works from the serialized documents. */ }
    try {
      if (options.describeChanges !== undefined) result.changes = options.describeChanges(source, candidate);
    } catch { /* As above. */ }
    return result;
  };
  return {
    /** @param source - Captured immutable candidate. @param signal - Operation cancellation. @returns Human decision. */
    request(source: QuireAiEditPreview, signal: AbortSignal): Promise<QuireAiEditPreviewDecision> {
      signal.throwIfAborted();
      const preview = copyDocumentJson({ id: uuidv4(), operationId: source.toolCallId,
        documentId: options.documentId, capabilityId: source.capabilityId, target: source.target,
        sourceDocumentRevision: source.sourceDocumentRevision, sourceDocument: source.sourceDocument.toJSON(),
        candidateDocument: source.candidateDocument.toJSON(),
        sourceText: source.sourceDocument.textBetween(0, source.sourceDocument.content.size, "\n", "\uFFFC"),
        candidateText: source.candidateDocument.textBetween(0, source.candidateDocument.content.size, "\n", "\uFFFC"),
        formatOnly: source.formatOnly,
        ...describe(source.sourceDocument, source.candidateDocument) });
      return new Promise((resolve, reject) => {
        /** Settles only once and removes the cancellation listener.
         * @param decision - Review outcome.
         * @param failure - Safe integration failure, distinct from a human rejection.
         */
        function settle(decision: QuireAiEditPreviewDecision | "cancelled", failure?: QuireDocumentSdkError): void {
          if (!pending.delete(preview.id)) return;
          signal.removeEventListener("abort", abort);
          emit({ type: "preview-settled", previewId: preview.id, decision });
          if (decision === "cancelled") reject(failure ?? signal.reason ?? new DOMException("Cancelled", "AbortError"));
          else resolve(decision);
        }
        /** Cancels a pending human decision without changing the document. */
        function abort(): void { settle("cancelled"); }
        pending.set(preview.id, settle);
        signal.addEventListener("abort", abort, { once: true });
        emit({ type: "preview", preview });
        if (signal.aborted) { abort(); return; }
        if (options.requestPreview !== undefined && pending.has(preview.id)) {
          // Host callbacks can be untyped or remote. Only explicit decisions may
          // unlock a write, and a cancelled request must never open a late review.
          void Promise.resolve().then(async () => {
            if (!pending.has(preview.id) || signal.aborted) return;
            const decision = await options.requestPreview!(preview, signal);
            if (decision !== "approved" && decision !== "rejected") {
              settle("cancelled", new QuireDocumentSdkError("invalid-preview-decision", "The review integration returned an invalid decision."));
              return;
            }
            settle(decision);
          }).catch(() => settle("cancelled", new QuireDocumentSdkError("preview-unavailable", "The review integration could not complete the request.")));
        }
      });
    },
    /**
     * Opens one review of a finished request's tracked changes; nobody waits on it, the decision is applied through the port.
     * @param requestId - Captured request.
     * @returns Whether a review was opened.
     */
    present(requestId: string): boolean {
      const port = options.requestReview;
      if (port === undefined) return false;
      // Direct writes made in place of tracked changes are part of the request: the source leaves them out.
      const current = options.editor.state.doc;
      const reverted = reverts.without(requestId, current);
      const tracked = port.snapshot(requestId);
      const source = reverted === null ? tracked?.source : port.snapshot(requestId, reverted)?.source ?? reverted;
      const candidate = tracked?.candidate ?? current;
      if (source === undefined || source.eq(candidate)) {
        reverts.forget(requestId);
        return false;
      }
      const sourceText = source.textBetween(0, source.content.size, "\n", "\uFFFC");
      const candidateText = candidate.textBetween(0, candidate.content.size, "\n", "\uFFFC");
      const preview = copyDocumentJson({ id: uuidv4(), operationId: requestId,
        documentId: options.documentId, capabilityId: "quire.ai.request-review", target: { kind: "request", id: requestId },
        sourceDocumentRevision: "", sourceDocument: source.toJSON(), candidateDocument: candidate.toJSON(),
        sourceText, candidateText, formatOnly: sourceText === candidateText, ...describe(source, candidate) });
      pending.set(preview.id, decision => {
        if (!pending.delete(preview.id)) return;
        let applied = false;
        if (decision === "rejected" && reverts.has(requestId)) {
          reverts.revert(requestId);
          applied = true;
        }
        if (decision !== "cancelled" && tracked !== null) applied = port.decide(requestId, decision) || applied;
        else if (decision === "approved") applied = true;
        reverts.forget(requestId);
        emit({ type: "preview-settled", previewId: preview.id, decision: applied ? decision : "cancelled" });
      });
      emit({ type: "preview", preview });
      return true;
    },
    /** @param id - Review identity. @param decision - User decision. @returns Whether this review was pending. */
    decide(id: string, decision: QuireAiEditPreviewDecision): boolean {
      if (decision !== "approved" && decision !== "rejected") return false;
      const settle = pending.get(id);
      if (settle === undefined) return false;
      settle(decision);
      return true;
    },
    /** Releases every pending review during SDK teardown. */
    destroy(): void { for (const settle of pending.values()) settle("cancelled"); }
  };
}
