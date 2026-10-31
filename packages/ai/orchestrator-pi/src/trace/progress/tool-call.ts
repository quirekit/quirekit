import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import type { QuireAiPiRunRequest } from "../../types";
import { emitTrace, observePresentation } from "../emit";
import type { QuireAiTraceProgressState } from "./types";

const progressCharacterStep = 256;

/**
 * Projects native Pi Tool-call argument streaming into bounded trace progress.
 *
 * @param event - Native Pi assistant-message event.
 * @param request - Current run and optional feature stream observer.
 * @param state - Run-bound progress state.
 */
export function observeToolCallProgress(
  event: AssistantMessageEvent,
  request: QuireAiPiRunRequest,
  state: QuireAiTraceProgressState
): void {
  if (event.type === "toolcall_end") {
    finishToolCallProgress(event.toolCall.id, event.toolCall.name, request, state);
    observePresentation(request.onToolCallStream, {
      type: "end",
      toolCallId: event.toolCall.id,
      toolName: event.toolCall.name
    });
    return;
  }
  if (event.type !== "toolcall_start" && event.type !== "toolcall_delta") return;
  const toolCall = event.partial.content[event.contentIndex];
  if (toolCall?.type !== "toolCall") return;
  if (event.type === "toolcall_start") {
    startToolCallProgress(toolCall.id, toolCall.name, request, state);
    observePresentation(request.onToolCallStream, {
      type: "start",
      toolCallId: toolCall.id,
      toolName: toolCall.name
    });
    return;
  }
  appendToolCallProgress(toolCall.id, toolCall.name, event.delta, request, state);
  observePresentation(request.onToolCallStream, {
    type: "delta",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    delta: event.delta
  });
}

/**
 * Starts one visible Tool-call argument stream.
 *
 * @param toolCallId - Provider-issued Tool-call identity.
 * @param toolName - Exact model-visible Tool name.
 * @param request - Current run and trace observer.
 * @param state - Run-bound progress state.
 */
function startToolCallProgress(
  toolCallId: string,
  toolName: string,
  request: QuireAiPiRunRequest,
  state: QuireAiTraceProgressState
): void {
  const startedAt = Date.now();
  state.starts.set(`tool:${toolCallId}`, startedAt);
  state.toolCalls.set(toolCallId, {
    name: toolName,
    chunks: 0,
    characters: 0,
    emitted: 0
  });
  emitToolCallProgress(state.operationId(toolCallId), toolCallId, toolName, request, startedAt, 0, 0);
}

/**
 * Accumulates one raw Tool argument fragment without displaying the JSON.
 *
 * @param toolCallId - Provider-issued Tool-call identity.
 * @param toolName - Exact model-visible Tool name.
 * @param delta - Raw append-only argument fragment.
 * @param request - Current run and trace observer.
 * @param state - Run-bound progress state.
 */
function appendToolCallProgress(
  toolCallId: string,
  toolName: string,
  delta: string,
  request: QuireAiPiRunRequest,
  state: QuireAiTraceProgressState
): void {
  const previous = state.toolCalls.get(toolCallId) ?? {
    name: toolName,
    chunks: 0,
    characters: 0,
    emitted: 0
  };
  const next = {
    ...previous,
    chunks: previous.chunks + 1,
    characters: previous.characters + delta.length
  };
  state.toolCalls.set(toolCallId, next);
  if (next.chunks !== 1 && next.characters - next.emitted < progressCharacterStep) return;
  next.emitted = next.characters;
  emitToolCallProgress(
    state.operationId(toolCallId),
    toolCallId,
    next.name,
    request,
    state.starts.get(`tool:${toolCallId}`) ?? Date.now(),
    next.characters,
    next.chunks
  );
}

/**
 * Flushes final Tool argument counts before Pi begins Tool execution.
 *
 * @param toolCallId - Provider-issued Tool-call identity.
 * @param toolName - Exact model-visible Tool name.
 * @param request - Current run and trace observer.
 * @param state - Run-bound progress state.
 */
function finishToolCallProgress(
  toolCallId: string,
  toolName: string,
  request: QuireAiPiRunRequest,
  state: QuireAiTraceProgressState
): void {
  const progress = state.toolCalls.get(toolCallId);
  emitToolCallProgress(
    state.operationId(toolCallId),
    toolCallId,
    progress?.name ?? toolName,
    request,
    state.starts.get(`tool:${toolCallId}`) ?? Date.now(),
    progress?.characters ?? 0,
    progress?.chunks ?? 0,
    true
  );
}

/**
 * Emits one bounded Tool-call progress snapshot into the original trace slot.
 *
 * @param operationId - Exact SDK identity resolved by the adapter.
 * @param toolCallId - Provider-issued Tool-call identity.
 * @param toolName - Exact model-visible Tool name.
 * @param request - Current run and trace observer.
 * @param startedAt - Millisecond start time shared with Tool execution.
 * @param characters - Accumulated raw argument character count.
 * @param chunks - Accumulated native Pi argument delta count.
 * @param complete - Whether the provider closed the Tool input boundary.
 */
function emitToolCallProgress(
  operationId: string,
  toolCallId: string,
  toolName: string,
  request: QuireAiPiRunRequest,
  startedAt: number,
  characters: number,
  chunks: number,
  complete = false
): void {
  const counts = characters === 0
    ? "Waiting for tool input"
    : `${characters.toLocaleString()} argument characters · ${chunks.toLocaleString()} chunks`;
  emitTrace(request, {
    id: `${request.id}:tool:${toolCallId}`,
    runId: request.id,
    operationId,
    kind: "tool-call",
    status: "running",
    label: toolName,
    toolName,
    detail: complete ? `${counts} · input complete` : counts,
    startedAt: new Date(startedAt).toISOString()
  });
}
