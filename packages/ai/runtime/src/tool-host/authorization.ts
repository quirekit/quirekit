import type {
  QuireAiToolHostOptions,
  QuireAiToolWriteContext,
  QuireAiToolWriteDecision,
  QuireAiToolWriteRequest
} from "./types";
import { QuireAiToolWriteError } from "./types";

/**
 * Validates product, view, target, and mode authority at one synchronous boundary.
 *
 * @param options - Host editor and product authorization policy.
 * @param request - Exact write request.
 * @param decision - Product policy result for this check.
 */
export function assertQuireAiWriteAllowed(
  options: QuireAiToolHostOptions,
  request: QuireAiToolWriteRequest,
  decision: QuireAiToolWriteDecision
): asserts decision is Extract<QuireAiToolWriteDecision, { readonly allowed: true }> {
  if (!decision.allowed) {
    throw new QuireAiToolWriteError(
      decision.code,
      decision.message ?? `Write permission denied for ${request.capabilityId}.`
    );
  }
  if (!options.editor.isEditable) {
    throw new QuireAiToolWriteError(
      "editor-read-only",
      "The editor is read-only; document Tools cannot write."
    );
  }
  if (!request.supportedModes.includes(decision.mode)) {
    throw new QuireAiToolWriteError(
      "unsupported-write-mode",
      `${request.capabilityId} does not support ${decision.mode} writes.`
    );
  }
  if (decision.mode === "tracked" && options.trackedReviewer === undefined) {
    throw new QuireAiToolWriteError(
      "missing-tracked-reviewer",
      `${request.capabilityId} requires a product-owned tracked reviewer.`
    );
  }
  const targetDecision = request.checkTarget?.(options.editor);
  if (targetDecision !== undefined && !targetDecision.writable) {
    throw new QuireAiToolWriteError(
      targetDecision.code,
      targetDecision.message ?? `Target rejected ${request.capabilityId}.`
    );
  }
}

/**
 * Creates immutable provenance for one admitted command invocation.
 *
 * @param options - Product-owned Host settings.
 * @param request - Exact Tool write request.
 * @param mode - Finally authorized materialization mode.
 * @returns Command context consumed directly by feature command bindings.
 */
export function createQuireAiCommandContext(
  options: QuireAiToolHostOptions,
  request: QuireAiToolWriteRequest,
  mode: QuireAiToolWriteContext["mode"]
): QuireAiToolWriteContext {
  return Object.freeze({
    mode,
    toolCallId: request.toolCallId,
    executionId: request.executionId ?? null,
    capabilityId: request.capabilityId,
    reviewer: mode === "tracked" ? options.trackedReviewer! : null,
    agent: options.trackedReviewer ?? null
  });
}

/**
 * Rejects optimistic writes whose read snapshot no longer matches the editor.
 *
 * @param request - Exact write request.
 * @param documentRevision - Current canonical document revision.
 */
export function assertQuireAiExpectedRevision(
  request: QuireAiToolWriteRequest,
  documentRevision: string
): void {
  if (
    request.expectedDocumentRevision !== undefined
    && request.expectedDocumentRevision !== documentRevision
  ) {
    throw new QuireAiToolWriteError(
      "stale-target",
      `Document changed before ${request.capabilityId} could run.`
    );
  }
}

/**
 * Projects only safe write facts into the product policy callback.
 *
 * @param request - Exact write request.
 * @returns Product authorization input without command callbacks.
 */
export function toQuireAiAuthorizationRequest(
  request: QuireAiToolWriteRequest
): Parameters<QuireAiToolHostOptions["authorizeWrite"]>[0] {
  return {
    toolCallId: request.toolCallId,
    capabilityId: request.capabilityId,
    target: request.target,
    ...(request.risk === undefined ? {} : { risk: request.risk })
  };
}
