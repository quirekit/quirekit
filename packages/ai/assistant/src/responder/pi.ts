import type { AiChatResponder } from "@quirekit/ai-chat";
import { createQuireAiPiCoordinator, type QuireAiAgentCoordinator, type QuireAiPiCoordinatorOptions } from "@quirekit/ai-orchestrator-pi";
import type { QuireAiRuntimeResolver } from "../connection/types";
import { composeQuireAiPrompt } from "./prompt";

/** System instructions and limits of a Pi-backed document assistant. */
export interface QuireAiPiResponderOptions {
  /** System instructions, composed by the AI core for the document model. */
  readonly systemPrompt: string;
  /** Model turns one request may take. */
  readonly maxModelTurns: number;
  /** Consecutive turns without document progress that stop a request early; default unlimited within maxModelTurns. */
  readonly maxIdleTurns?: number | undefined;
  /** Builds the prompt of a request; default today's date, the reply language and the document context. */
  readonly composePrompt?: typeof composeQuireAiPrompt | undefined;
  /** Opens a stored conversation or creates a new one after reset, so a host can keep model memory across restarts; default in memory. */
  readonly openSession?: QuireAiPiCoordinatorOptions["openSession"];
}

/**
 * Binds a workspace to one persistent Pi conversation.
 * @param resolveRuntime - Model runtime for the selected profile.
 * @param options - System instructions and limits.
 * @returns Responder whose native transcript survives every panel remount and turn.
 */
export function createQuireAiPiResponder(resolveRuntime: QuireAiRuntimeResolver, options: QuireAiPiResponderOptions): AiChatResponder {
  const compose = options.composePrompt ?? composeQuireAiPrompt;
  let coordinator: QuireAiAgentCoordinator | undefined;
  let destroyed = false;
  return {
    async respond(request) {
      const runtime = await resolveRuntime(request);
      request.signal.throwIfAborted();
      if (destroyed) throw new Error("The document conversation is closed.");
      coordinator ??= createQuireAiPiCoordinator({ ...runtime, systemPrompt: options.systemPrompt, maxModelTurns: options.maxModelTurns,
        ...(options.maxIdleTurns === undefined ? {} : { maxIdleTurns: options.maxIdleTurns }),
        ...(options.openSession === undefined ? {} : { openSession: options.openSession }) });
      return coordinator.run({
        id: request.id, prompt: compose(request.document, request.requestId, request.prompt), document: request.document,
        requestId: request.requestId, runtime, signal: request.signal,
        onContentDelta: request.onContentDelta, onReasoningDelta: request.onReasoningDelta, onTrace: request.onTrace
      });
    },
    async reset() { await coordinator?.reset(); },
    async destroy() { destroyed = true; await coordinator?.close(); }
  };
}
