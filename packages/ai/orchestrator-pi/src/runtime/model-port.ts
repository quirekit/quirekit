import type { ThinkingLevel } from "@earendil-works/pi-ai";

/** Reasoning effort of transform calls; `off` sends no reasoning request. */
export type QuireAiPiModelPortThinking = ThinkingLevel | "off";
import type { QuireAiModelPort } from "@quirekit/ai-runtime";
import type { QuireAiPiModelRuntime } from "../types";

/** Options of the transform model port. */
export interface QuireAiPiModelPortOptions {
  /** Reasoning effort for each call; defaults to the runtime's selection. */
  readonly thinkingLevel?: QuireAiPiModelPortThinking | undefined;
}

/**
 * Serves document transforms' plain-text completions from a Pi model runtime.
 *
 * Each call sends one system prompt and one user message without tools and
 * returns the assistant's text with token usage, including prompt-cache reads.
 *
 * @param runtime - Pi model runtime of the connection.
 * @param options - Per-port reasoning override.
 * @returns Model port for `document_transform`.
 */
export function createQuireAiPiModelPort(
  runtime: QuireAiPiModelRuntime,
  options: QuireAiPiModelPortOptions = {}
): QuireAiModelPort {
  const selected = options.thinkingLevel ?? runtime.thinkingLevel;
  // "off" is expressed by leaving reasoning out of the request.
  const reasoning = selected === undefined || selected === "off" ? undefined : selected;
  const port: QuireAiModelPort = {
    async complete({ system, prompt, signal }) {
      const message = await runtime.models.completeSimple(runtime.model, {
        systemPrompt: system,
        messages: [{ role: "user" as const, content: prompt, timestamp: Date.now() }]
      }, { signal, ...(reasoning === undefined ? {} : { reasoning }) });
      if (message.stopReason === "error" || message.stopReason === "aborted") {
        signal.throwIfAborted();
        throw new Error(message.errorMessage ?? "The model request failed.");
      }
      const text = message.content.flatMap(part => part.type === "text" ? [part.text] : []).join("");
      return { text, usage: { input: message.usage.input, output: message.usage.output, cacheRead: message.usage.cacheRead } };
    }
  };
  return Object.freeze(port);
}
