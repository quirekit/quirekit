import { QuireDocumentSdkError } from "../document-sdk/error";
import type { QuireAiToolWriteAuthorizationRequest, QuireAiToolWriteReceipt } from "../tool-host";
import type { QuireAiSourceRecorder } from "./review/record";
import type { QuireAiSourceDocument, QuireAiSourceStep, QuireAiSourceStepResult, QuireAiSourceWriteDecision } from "./types";

/** Writes of one source document SDK, under the application's policy. */
export interface QuireAiSourceWriter {
  /**
   * Applies steps as one transaction after the policy allows it, recording them for review when asked.
   * @param steps - Steps to apply.
   * @param write - Request, operation and capability of the write.
   * @returns Outcome of the editor.
   */
  write(steps: readonly QuireAiSourceStep[], write: {
    /** Captured request. */
    readonly requestId: string | null;
    /** Logical operation. */
    readonly operationId: string;
    /** Capability writing. */
    readonly capabilityId: string;
  }): QuireAiSourceStepResult;
}

/**
 * Creates the writer.
 * @param options - Port, recorder, policy, identity and receipt sink.
 * @returns Writer.
 */
export function createQuireAiSourceWriter(options: {
  /** Source document port. */
  readonly document: QuireAiSourceDocument;
  /** Request recorder. */
  readonly recorder: QuireAiSourceRecorder;
  /** Application write policy; default allowed without review. */
  readonly authorizeWrite?: ((request: QuireAiToolWriteAuthorizationRequest) => QuireAiSourceWriteDecision) | undefined;
  /** Identity the AI writes as. */
  readonly agent: { readonly id: string; readonly name: string } | null;
  /** Receives one receipt per commit. */
  readonly receipt: (receipt: QuireAiToolWriteReceipt) => void;
}): QuireAiSourceWriter {
  return {
    write(steps, write) {
      const { document } = options;
      if (!document.isEditable()) throw new QuireDocumentSdkError("read-only", "The document is read-only.");
      const target = { kind: "document-blocks", id: write.capabilityId };
      const decision = options.authorizeWrite?.({ toolCallId: write.operationId, capabilityId: write.capabilityId, target }) ?? { allowed: true, review: false };
      if (!decision.allowed) throw new QuireDocumentSdkError("permission-denied", decision.reason);
      if (decision.review && write.requestId !== null) options.recorder.start(write.requestId);
      const sourceDocumentRevision = document.revision();
      const result = document.apply(steps, { requestId: write.requestId, operationId: write.operationId, author: options.agent });
      if (result.ok) {
        options.receipt({ toolCallId: write.operationId, capabilityId: write.capabilityId, mode: "direct", target, sourceDocumentRevision, documentRevision: document.revision() });
      }
      return result;
    }
  };
}
