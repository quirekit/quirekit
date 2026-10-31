import type { HarnessEvent } from "@earendil-works/pi-agent-core";
import { readAssistantErrorMessage } from "../conversation";
import type { QuireAiPiRunRequest } from "../types";
import { emitTrace, observePresentation } from "./emit";
import {
  observeToolCallProgress,
  type QuireAiTraceProgressState
} from "./progress";
import {
  projectTraceToolArguments,
  projectTraceToolResult
} from "./projection";

/**
 * Handles native Pi lifecycle events and emits auditable trace snapshots.
 *
 * @param event - Pi event.
 * @param request - Current run and observers.
 * @param progress - Trace timings and transport-progress counters.
 * @param nextTurn - Allocates a model-turn sequence.
 */
export function handleAgentEvent(
  event: HarnessEvent,
  request: QuireAiPiRunRequest,
  progress: QuireAiTraceProgressState,
  nextTurn: () => number
): void {
  const starts = progress.starts;
  if (event.type === "turn_start") {
    const sequence = nextTurn();
    const id = `${request.id}:model:${sequence}`;
    starts.set("model", Date.now());
    starts.set("model-id", sequence);
    emitTrace(request, {
      id,
      runId: request.id,
      kind: "model",
      status: "running",
      label: `Model turn ${sequence}`,
      startedAt: new Date(starts.get("model")!).toISOString()
    });
    return;
  }
  if (event.type === "message_update") {
    if (event.event.type === "text_delta") {
      observePresentation(request.onContentDelta, event.event.delta);
      return;
    }
    if (event.event.type === "thinking_delta") {
      observePresentation(request.onReasoningDelta, event.event.delta);
      return;
    }
    observeToolCallProgress(event.event, request, progress);
    return;
  }
  if (event.type === "turn_end") {
    const sequence = starts.get("model-id") ?? 1;
    const startedAt = starts.get("model") ?? Date.now();
    const finishedAt = Date.now();
    const providerFailure = readAssistantErrorMessage(event.message);
    const failed = providerFailure !== undefined;
    emitTrace(request, {
      id: `${request.id}:model:${sequence}`,
      runId: request.id,
      kind: "model",
      status: failed ? "failed" : "succeeded",
      label: `Model turn ${sequence}`,
      detail: failed ? "The provider request failed." : `${event.toolResults.length} tool result(s)`,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      durationMs: finishedAt - startedAt,
      ...(failed ? { errorCode: "provider-turn-failed" } : {})
    });
    return;
  }
  if (event.type === "tool_start") {
    const startedAt = starts.get(`tool:${event.toolCallId}`) ?? Date.now();
    starts.set(`tool:${event.toolCallId}`, startedAt);
    emitTrace(request, {
      id: `${request.id}:tool:${event.toolCallId}`,
      runId: request.id,
      operationId: progress.operationId(event.toolCallId),
      kind: "tool-call",
      status: "running",
      label: event.toolName,
      toolName: event.toolName,
      arguments: projectTraceToolArguments(event.args),
      startedAt: new Date(startedAt).toISOString()
    });
    return;
  }
  if (event.type === "tool_end") {
    const startedAt = starts.get(`tool:${event.toolCallId}`) ?? Date.now();
    const finishedAt = Date.now();
    // Settle the original tool slot so its disclosure keeps focus and expansion state.
    emitTrace(request, {
      id: `${request.id}:tool:${event.toolCallId}`,
      runId: request.id,
      operationId: progress.operationId(event.toolCallId),
      kind: "tool-call",
      status: event.isError ? "failed" : "succeeded",
      label: event.toolName,
      toolName: event.toolName,
      result: projectTraceToolResult(event.result),
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      durationMs: finishedAt - startedAt,
      ...(event.isError ? { errorCode: "tool-failed" } : {})
    });
  }
}
