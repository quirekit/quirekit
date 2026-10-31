import { v4 as uuidv4 } from "uuid";
import { copyDocumentJson } from "../../document-sdk/json";
import type { QuireDocumentSdkEnginePreviews } from "../../document-sdk/shell";
import type { QuireDocumentChange, QuireDocumentEvent } from "../../document-sdk/types";
import type { QuireAiEditPreviewDecision } from "../../tool-host";
import type { QuireAiSourceDocument } from "../types";
import { describeQuireAiSourceChanges } from "./changes";
import { applyQuireAiSourceTextSteps, type QuireAiSourceRecorder } from "./record";

/**
 * Creates the review store of a source document: one review per request that wrote recorded
 * changes; approving keeps them, rejecting takes them back as one undo step.
 * @param document - Source document port.
 * @param documentId - Application document identity.
 * @param recorder - Request recorder.
 * @param emit - Fact publisher.
 * @returns Review store of the SDK engine.
 */
export function createQuireAiSourcePreviews(document: QuireAiSourceDocument, documentId: string, recorder: QuireAiSourceRecorder,
  emit: (event: QuireDocumentEvent) => void): QuireDocumentSdkEnginePreviews {
  const pending = new Map<string, (decision: QuireAiEditPreviewDecision | "cancelled") => void>();
  return {
    present(requestId) {
      if (!recorder.has(requestId)) {
        recorder.forget(requestId);
        return false;
      }
      const candidate = document.text();
      const source = applyQuireAiSourceTextSteps(candidate, recorder.revert(requestId));
      const described = recorder.described(requestId);
      if (source === candidate && described.length === 0) {
        recorder.forget(requestId);
        return false;
      }
      const changes: QuireDocumentChange[] = [
        ...describeQuireAiSourceChanges(document, source, candidate),
        ...described.map((change): QuireDocumentChange => ({ kind: change.kind, section: change.section, excerpt: change.excerpt, formats: [] }))
      ];
      const preview = copyDocumentJson({
        id: uuidv4(), operationId: requestId, documentId, capabilityId: "quire.ai.request-review", target: { kind: "request", id: requestId },
        sourceDocumentRevision: "", sourceDocument: source, candidateDocument: candidate, sourceText: source, candidateText: candidate,
        formatOnly: false, sourceView: source, candidateView: candidate, changes
      });
      pending.set(preview.id, decision => {
        if (!pending.delete(preview.id)) return;
        let applied = decision === "approved";
        if (decision === "rejected") {
          const steps = recorder.revert(requestId);
          recorder.forget(requestId);
          applied = steps.length === 0 || document.apply(steps, { requestId: null, operationId: `revert-${requestId}`, author: null }).ok;
        }
        recorder.forget(requestId);
        emit({ type: "preview-settled", previewId: preview.id, decision: applied ? decision as QuireAiEditPreviewDecision : "cancelled" });
      });
      emit({ type: "preview", preview });
      return true;
    },
    decide(id, decision) {
      if (decision !== "approved" && decision !== "rejected") return false;
      const settle = pending.get(id);
      if (settle === undefined) return false;
      settle(decision);
      return true;
    },
    destroy() { for (const settle of pending.values()) settle("cancelled"); }
  };
}
