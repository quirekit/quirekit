import { commitQuireAiDirectFallback, commitQuireAiWrite } from "./commit";
import { createQuireAiDocumentRevision } from "./revision";
import {
  assertQuireAiExpectedRevision,
  assertQuireAiWriteAllowed,
  toQuireAiAuthorizationRequest
} from "./authorization";
import { executeQuireAiPreviewWrite } from "./preview";
import {
  QuireAiToolWriteError,
  type QuireAiToolHost,
  type QuireAiToolHostOptions,
  type QuireAiToolWriteAuthorizationRequest,
  type QuireAiToolWriteRequest
} from "./types";

/**
 * Binds read and write Tool services to one canonical editor instance.
 *
 * @param options - Editor and synchronous product authorization policy.
 * @returns Editor-scoped Host used directly by feature-owned document tools.
 */
export function createQuireAiToolHost(
  options: QuireAiToolHostOptions
): QuireAiToolHost {
  return Object.freeze({
    /** @param signal - Cancellation authority. @param query - Bounded document query. @returns Query result. */
    read<Result>(
      signal: AbortSignal,
      query: (editor: QuireAiToolHostOptions["editor"]) => Result
    ): Result {
      signal.throwIfAborted();
      const result = query(options.editor);
      signal.throwIfAborted();
      return result;
    },
    /** @param request - Authorization facts. @returns What policy would choose, or null when refused. */
    peekWrite(request: QuireAiToolWriteAuthorizationRequest) {
      const decision = options.authorizeWrite(request);
      return decision.allowed ? { mode: decision.mode, previewRequired: decision.preview === "required" } : null;
    },
    /** @param request - Feature command binding. @returns Actual commit or no-change facts. */
    async executeWrite(request: QuireAiToolWriteRequest) {
      request.signal.throwIfAborted();
      const sourceDocumentRevision = createQuireAiDocumentRevision(
        options.editor.state.doc
      );
      assertQuireAiExpectedRevision(request, sourceDocumentRevision);

      // Preflight reads every mutable gate without crossing the command boundary.
      const initialDecision = options.authorizeWrite(
        toQuireAiAuthorizationRequest(request)
      );
      assertQuireAiWriteAllowed(options, request, initialDecision);
      if (!request.canApply(options.editor, initialDecision.mode)) {
        throw new QuireAiToolWriteError(
          "command-unavailable",
          `Command is unavailable for ${request.capabilityId}.`
        );
      }
      if (initialDecision.preview === "required") {
        return executeQuireAiPreviewWrite(
          options,
          request,
          sourceDocumentRevision,
          initialDecision
        );
      }

      // Recheck synchronous authority next to commit so stale transcript Tools fail closed.
      request.signal.throwIfAborted();
      assertQuireAiExpectedRevision(request, createQuireAiDocumentRevision(
        options.editor.state.doc
      ));
      const finalDecision = options.authorizeWrite(
        toQuireAiAuthorizationRequest(request)
      );
      assertQuireAiWriteAllowed(options, request, finalDecision);
      if (!request.canApply(options.editor, finalDecision.mode)) {
        throw new QuireAiToolWriteError(
          "command-unavailable",
          `Command became unavailable for ${request.capabilityId}.`
        );
      }
      request.signal.throwIfAborted();

      if (finalDecision.preview === "required") {
        return executeQuireAiPreviewWrite(options, request, sourceDocumentRevision, finalDecision);
      }
      const revertible = finalDecision.untrackedFallback === "revert";
      const result = commitQuireAiWrite(options, request, finalDecision.mode, sourceDocumentRevision);
      if (result.applied || finalDecision.mode !== "tracked") return result;
      // A change the revision system cannot record is written directly when the request review can
      // take it back; otherwise it may be offered for approval.
      if (revertible) return commitQuireAiDirectFallback(options, request, sourceDocumentRevision, true);
      if (finalDecision.untrackedFallback === "preview" && request.allowUntrackedFallback !== false) {
        return executeQuireAiPreviewWrite(options, request, sourceDocumentRevision, { allowed: true, mode: "direct", preview: "required" }, true);
      }
      return result;
    }
  });
}
