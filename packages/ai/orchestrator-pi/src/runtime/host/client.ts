import { piMessagesApi } from "@earendil-works/pi-ai/api/pi-messages.lazy";
import {
  createModels,
  createProvider,
  type Model,
  type Models
} from "@earendil-works/pi-ai";
import type { QuireAiPiModelRuntime } from "../../types";
import type { QuireAiPiHostRuntimeOptions } from "../types";
import { resolveQuireAiPiHostEndpoint } from "./endpoint";
import { bindPiRequestPolicy } from "../request-policy";

/**
 * Creates one native Pi messages client runtime.
 *
 * @param options - Host URL, selected safe profile, headers, and request policy.
 * @returns Real Pi model and provider-bound stream function.
 */
export function createQuireAiPiHostRuntime(
  options: QuireAiPiHostRuntimeOptions
): QuireAiPiModelRuntime {
  const baseUrl = resolveQuireAiPiHostEndpoint(options.hostUrl, "");
  const model: Model<"pi-messages"> = {
    id: options.profile.id,
    name: options.profile.label,
    api: "pi-messages",
    provider: `quirekit-host-${options.profile.id}`,
    baseUrl,
    reasoning: options.profile.capabilities.reasoning === true,
    input: options.profile.capabilities.vision === true ? ["text", "image"] : ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: options.profile.contextWindowTokens ?? 128_000,
    maxTokens: options.profile.maxOutputTokens ?? 8_000
  };
  const provider = createProvider({
    id: model.provider,
    name: "QuireKit Pi Provider Host",
    baseUrl,
    auth: {
      apiKey: {
        name: "Host request headers",
        async resolve() {
          return {
            auth: {
              apiKey: "host",
              headers: headersInitToRecord(await options.getHeaders?.())
            },
            source: "application Host"
          };
        }
      }
    },
    models: [model],
    api: bindPiRequestPolicy(piMessagesApi(), options)
  });
  const models = createModels();
  models.setProvider(provider);
  const streamFn: Models["streamSimple"] = (selectedModel, context, streamOptions) => (
    models.streamSimple(selectedModel, context, {
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
    thinkingLevel: model.reasoning ? "high" : "off"
  });
}

/**
 * Converts optional application headers into Pi's provider-header record.
 *
 * @param value - Optional headers.
 * @returns Header record.
 */
function headersInitToRecord(value: HeadersInit | undefined): Record<string, string> {
  return Object.fromEntries(new Headers(value).entries());
}
