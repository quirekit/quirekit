import { appendAiChatTextMessagePart, finalizeAiChatMessageParts, upsertAiChatTraceMessagePart } from "../message-parts/model";
import { resolveAiChatSelectedModel } from "../model-selection";
import type { AiChatWorkspaceOptions } from "../types";
import { createChatId, publish, updateChatMessage } from "./state";
import type { ChatState } from "./types";

/** Capture the exact target before the first asynchronous model operation.
 * @param state - Retained conversation state.
 * @param options - Public document and persistent harness ports.
 * @returns Turn settlement, with failures retained as presentation state.
 */
export function submitChatTurn(state: ChatState, options: AiChatWorkspaceOptions): Promise<void> {
  if (state.destroyed || state.snapshot.pending || !state.snapshot.draft.trim()) return Promise.resolve();
  const prompt = state.snapshot.draft;
  const id = createChatId("turn");
  const messageId = `${id}-assistant`;
  const controller = new AbortController();
  const active = { controller, messageId, settled: undefined as Promise<void> | undefined };
  state.active = active;
  publish(state, {
    draft: "", pending: true, errorCode: undefined,
    messages: [...state.snapshot.messages,
      { id: `${id}-user`, role: "user", content: prompt, createdAt: new Date().toISOString(), status: "complete" },
      { id: messageId, role: "assistant", content: "", parts: [], createdAt: new Date().toISOString(), pending: true, status: "pending" }]
  });
  const authorizationMode = state.snapshot.authorizationMode;
  const model = resolveAiChatSelectedModel(state.snapshot.models, state.snapshot.selectedModelId);
  let requestId: string | undefined;
  try { requestId = options.document.captureRequest().id; }
  catch (error) {
    fail(error);
    state.active = undefined;
    publish(state, { pending: false });
    return Promise.resolve();
  }
  let sequence = 0;
  /** @returns Current assistant message. */
  const current = () => state.snapshot.messages.find(message => message.id === messageId)!;
  /** @returns Whether this observer still belongs to the live turn. */
  const live = () => !state.destroyed && state.active === active && !controller.signal.aborted;
  /** @param kind - Part family. @returns Stable part identity. */
  const nextPart = (kind: string) => `${messageId}:${kind}:${++sequence}`;
  /** @param error - Terminal adapter failure. */
  function fail(error: unknown): void {
    const code = controller.signal.aborted ? "cancelled" : readErrorCode(error);
    publish(state, { errorCode: code });
    const message = state.snapshot.messages.find(item => item.id === messageId);
    updateChatMessage(state, messageId, {
      pending: false, errorCode: code, status: code === "cancelled" ? "stopped" : "error",
      parts: finalizeAiChatMessageParts(message?.parts ?? [], "", kind => `${messageId}:final:${kind}`)
    });
  }
  active.settled = (async () => {
    try {
      const result = await options.responder.respond({
        id, prompt, model, authorizationMode, document: options.document, requestId: requestId!, signal: controller.signal,
        onContentDelta(content) {
          if (!live() || !content) return;
          updateChatMessage(state, messageId, { content: current().content + content, status: "streaming",
            parts: appendAiChatTextMessagePart(current().parts ?? [], "content", nextPart("content"), content) });
        },
        onReasoningDelta(content) {
          if (!live() || !content) return;
          updateChatMessage(state, messageId, { status: "streaming",
            parts: appendAiChatTextMessagePart(current().parts ?? [], "reasoning", nextPart("reasoning"), content) });
        },
        onTrace(entry) {
          if (state.destroyed || state.active !== active) return;
          updateChatMessage(state, messageId, { parts: upsertAiChatTraceMessagePart(current().parts ?? [], entry) });
        }
      });
      controller.signal.throwIfAborted();
      updateChatMessage(state, messageId, { content: result.content, pending: false, status: "complete",
        parts: finalizeAiChatMessageParts(current().parts ?? [], result.content, nextPart) });
    } catch (error) { fail(error); }
    finally {
      // Stopped and failed turns are reviewed too: what they already wrote stays pending, not lost.
      if (!state.destroyed) {
        try { options.document.reviewRequest(requestId!); } catch { /* Review is optional; the turn still settles. */ }
      }
      options.document.releaseRequest(requestId!);
      if (state.active === active) { state.active = undefined; publish(state, { pending: false }); }
    }
  })();
  return active.settled;
}

/** Read only a stable machine category; arbitrary provider bodies never become user copy.
 * @param error - Unknown execution failure.
 * @returns Safe failure classification.
 */
function readErrorCode(error: unknown): string {
  if (error !== null && typeof error === "object" && "code" in error && typeof error.code === "string"
    && ["cancelled", "timeout", "turn-budget-exceeded", "no-progress", "provider-failed", "session-failed", "busy", "closed", "document-mismatch", "invalid-response"].includes(error.code)) return error.code;
  return "session-failed";
}
