import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import {
  createModels,
  createProvider,
  type Api,
  type Model,
  type Models,
  type ProviderStreams
} from "@earendil-works/pi-ai";
import type { QuireAiPiModelRuntime } from "../types";
import type {
  QuireAiPiDirectApi,
  QuireAiPiDirectRuntimeOptions
} from "./types";
import { bindPiRequestPolicy } from "./request-policy";

const apiImplementations: Readonly<Record<QuireAiPiDirectApi, ProviderStreams>> = {
  "openai-completions": openAICompletionsApi(),
  "openai-responses": openAIResponsesApi(),
  "anthropic-messages": anthropicMessagesApi()
};

/**
 * Creates one browser-direct runtime entirely from Pi provider primitives.
 *
 * @param options - Pi API, model, auth, and request policy.
 * @returns Real Pi model and provider-bound stream function.
 */
export function createQuireAiPiDirectRuntime(
  options: QuireAiPiDirectRuntimeOptions
): QuireAiPiModelRuntime {
  const model: Model<QuireAiPiDirectApi> = {
    id: options.modelId,
    name: options.modelId,
    api: options.api,
    provider: options.id,
    baseUrl: options.baseUrl,
    reasoning: options.reasoning,
    input: [...options.input ?? ["text"]],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: options.contextWindow,
    maxTokens: options.maxTokens,
    // The base URL is often a same-origin gateway, so URL detection cannot recognize the provider; every
    // OpenAI-compatible service accepts `system`, while many reject the newer `developer` role.
    ...(options.api === "openai-completions" ? { compat: { supportsDeveloperRole: false } } : {})
  };
  const provider = createProvider<QuireAiPiDirectApi>({
    id: options.id,
    name: options.providerName,
    baseUrl: options.baseUrl,
    ...(options.headers === undefined ? {} : { headers: options.headers }),
    auth: {
      apiKey: {
        name: `${options.providerName} API key`,
        async resolve() {
          return { auth: typeof options.auth === "function" ? await options.auth() : options.auth, source: "application profile" };
        }
      }
    },
    models: [model],
    api: bindPiRequestPolicy(apiImplementations[options.api], options)
  });
  const models = createModels();
  models.setProvider(provider);
  const streamFn: Models["streamSimple"] = (selectedModel, context, streamOptions) => (
    models.streamSimple(selectedModel as Model<Api>, context, {
      ...streamOptions,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries })
    })
  );
  return Object.freeze({
    models,
    model,
    streamFn,
    thinkingLevel: options.thinkingLevel ?? (options.reasoning ? "high" : "off")
  });
}
