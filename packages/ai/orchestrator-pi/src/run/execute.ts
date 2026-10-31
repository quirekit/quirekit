import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core/harness/context";
import { QuireAiPiError } from "../errors";
import { readFinalAssistantText } from "../conversation";
import { bindSessionDocument, type PiSessionController } from "../session";
import { createDocumentPiTools } from "../tools";
import type { QuireAiPiRunRequest, QuireAiPiRunResult } from "../types";
import { createPiRunControl } from "./control";
import { observePiRun, emitPiRunEnd } from "./observe";
import type { PiRunBudgetLimits } from "./types";

/**
 * Appends one prompt and delegates operation execution entirely to Pi Harness.
 * @param sessions - Persistent conversation owner.
 * @param request - Public SDK, prompt and presentation observers.
 * @param signal - Coordinator-owned combined cancellation signal.
 * @param timeoutMs - Provider-only idle bound.
 * @param limits - Hard and idle model-turn bounds.
 * @returns Successful terminal projection with native session identity.
 */
export async function executePiRun(
  sessions: PiSessionController,
  request: QuireAiPiRunRequest,
  signal: AbortSignal,
  timeoutMs: number,
  limits: PiRunBudgetLimits
): Promise<QuireAiPiRunResult> {
  let requestId = request.requestId;
  const startedAt = Date.now();
  try {
    if (signal.aborted) throw new QuireAiPiError("cancelled", "The document run was cancelled.");
    requestId ??= request.document.captureRequest().id;
    const state = await sessions.configure(request.runtime, request.systemPrompt);
    await bindSessionDocument(state.session, request.document.documentId);
    if (signal.aborted) throw new QuireAiPiError("cancelled", "The document run was cancelled.");
    const control = createPiRunControl(state.lane, request.id, signal, timeoutMs);
    let stopObserving = (): void => undefined;
    try {
      const tools = createDocumentPiTools(request.document, state.session.metadata.id, request.id, requestId, control.signal);
      await state.harness.setTools(tools, BACKGROUND_CONTEXT);
      await state.lane.setActiveTools(tools.map(tool => tool.name), BACKGROUND_CONTEXT);
      const previousTip = await state.lane.getTipId(BACKGROUND_CONTEXT);
      stopObserving = observePiRun(state, request, requestId, control, limits);
      if (signal.aborted) throw new QuireAiPiError("cancelled", "The document run was cancelled.");
      const admission = await state.lane.accept({ kind: "prompt", prompt: request.prompt, operationId: request.id }, BACKGROUND_CONTEXT);
      if (!admission.ok) throw new QuireAiPiError("session-failed", "The conversation could not accept this request.");
      // A caller may cancel while the admission transaction is committing.
      if (signal.aborted) await control.cancel("cancelled");
      const result = await state.lane.drive({ operationId: request.id, waitForRetry: true }, BACKGROUND_CONTEXT);
      await state.lane.waitForIdle(BACKGROUND_CONTEXT);
      if (control.reason !== undefined) throw new QuireAiPiError(control.reason, failureMessage(control.reason));
      if (!result.ok || result.value.kind !== "settled") {
        throw new QuireAiPiError("session-failed", "The model run did not reach a supported terminal state.");
      }
      if (result.value.outcome.status !== "completed") {
        const cancelled = result.value.outcome.status === "aborted";
        throw new QuireAiPiError(cancelled ? "cancelled" : "provider-failed", cancelled ? "The document run was cancelled." : "The model could not complete this request.");
      }
      const entries = await state.lane.findEntries(undefined, BACKGROUND_CONTEXT);
      const owned = [];
      for (const entry of entries) {
        if (entry.id === previousTip) break;
        if (entry.type === "message") owned.push(entry.message);
      }
      // Block ids address blocks for the model; the reply people read names blocks instead.
      const content = request.document.presentReply(readFinalAssistantText(owned.reverse(), 0));
      if (content.length === 0) throw new QuireAiPiError("invalid-response", "The model completed without a visible response or tool result.");
      emitPiRunEnd(request, startedAt);
      return { content, sessionId: state.session.metadata.id, operationId: request.id, status: "completed" };
    } finally {
      stopObserving();
      control.dispose();
    }
  } catch (error) {
    const failure = error instanceof QuireAiPiError ? error
      : new QuireAiPiError(signal.aborted ? "cancelled" : "session-failed", signal.aborted ? "The document run was cancelled." : "The conversation could not complete this request.");
    emitPiRunEnd(request, startedAt, failure);
    throw failure;
  } finally {
    if (requestId !== undefined) request.document.releaseRequest(requestId);
  }
}

/**
 * Provides stable public termination text without upstream response data.
 * @param code - Local termination classification.
 * @returns Safe explanation.
 */
function failureMessage(code: string): string {
  if (code === "timeout") return "The model stopped responding before the idle deadline.";
  if (code === "turn-budget-exceeded") return "The document run reached its model-turn budget.";
  if (code === "no-progress") return "Consecutive model turns made no document progress.";
  return "The document run was cancelled.";
}
