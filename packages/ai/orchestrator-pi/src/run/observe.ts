import type { HarnessEvent, HarnessEventType } from "@earendil-works/pi-agent-core";
import type { QuireAiPiError } from "../errors";
import type { PiSessionState } from "../session";
import { documentOperationId, observeDocumentPiInput } from "../tools";
import { createQuireAiTraceProgressState, emitTrace, handleAgentEvent } from "../trace";
import type { QuireAiPiRunRequest } from "../types";
import { createQuireAiPiReplyPresenter } from "./reply";
import { createPiRunBudget } from "./budget";
import type { PiRunBudgetLimits, PiRunControl } from "./types";

const observedEvents: readonly HarnessEventType[] = [
  "run_start", "turn_start", "turn_end", "message_update", "message_end",
  "tool_start", "tool_update", "tool_end"
];

/**
 * Observes native state and enforces admission before an extra provider request.
 * @param state - Persistent native session and lane.
 * @param request - Current public request and UI observers.
 * @param requestId - Captured SDK target identity.
 * @param control - Cancellation and provider-idle authority.
 * @param limits - Hard and idle model-turn bounds.
 * @returns Idempotent observer cleanup.
 */
export function observePiRun(state: PiSessionState, request: QuireAiPiRunRequest, requestId: string, control: PiRunControl, limits: PiRunBudgetLimits): () => void {
  const progress = createQuireAiTraceProgressState(toolCallId => documentOperationId(state.session.metadata.id, request.id, toolCallId));
  // Streamed text reaches people without internal block ids, like the final reply.
  const reply = createQuireAiPiReplyPresenter(request.document, request.onContentDelta);
  const presented: QuireAiPiRunRequest = { ...request, onContentDelta: delta => reply.push(delta) };
  const budget = createPiRunBudget(request.document, state.session.metadata.id, request.id, requestId, limits);
  let sequence = 0;
  const unsubscribeBudget = state.harness.hooks.on("before_request", async (event) => {
    if (event.runId !== request.id) return undefined;
    if (event.step === "assistant" && event.attempt === 1) {
      const stop = budget.admit();
      if (stop !== undefined) {
        await control.cancel(stop);
        return undefined;
      }
    }
    control.touchProvider();
    return undefined;
  });
  /**
   * Projects each native event without granting UI or streaming input mutation authority.
   * @param event - Native Pi event.
   */
  function observe(event: HarnessEvent): void {
    if (!("runId" in event) || event.runId !== request.id) return;
    if (event.type === "run_start") {
      emitTrace(request, {
        id: `${request.id}:agent`, runId: request.id, kind: "agent", status: "running",
        label: "Document Agent", startedAt: new Date(event.startedAt).toISOString()
      });
    }
    if (event.type === "message_update") {
      control.touchProvider();
      observeDocumentPiInput(event.event, request.document, state.session.metadata.id, request.id, requestId, control.signal);
    }
    if (event.type === "tool_start") budget.start(event.toolCallId, event.toolName, event.args);
    if (event.type === "tool_end") budget.end(event.toolCallId, event.isError);
    if (event.type === "message_end" && event.message.role === "assistant") control.stopProvider();
    handleAgentEvent(event, presented, progress, () => ++sequence);
    if (event.type === "message_end" && event.message.role === "assistant") reply.flush();
  }
  const unsubscribers = observedEvents.map(type => state.harness.events.on(type, observe));
  return () => {
    unsubscribeBudget();
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

/**
 * Emits terminal presentation only after native execution has settled.
 * @param request - Run observers.
 * @param startedAt - Original wall-clock start.
 * @param failure - Optional typed terminal failure.
 */
export function emitPiRunEnd(request: QuireAiPiRunRequest, startedAt: number, failure?: QuireAiPiError): void {
  const endedAt = Date.now();
  emitTrace(request, {
    id: `${request.id}:agent`, runId: request.id, kind: "agent",
    status: failure === undefined ? "succeeded" : failure.code === "cancelled" ? "cancelled" : "failed",
    label: "Document Agent", startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(endedAt).toISOString(), durationMs: endedAt - startedAt,
    ...(failure === undefined ? {} : { errorCode: failure.code })
  });
}
