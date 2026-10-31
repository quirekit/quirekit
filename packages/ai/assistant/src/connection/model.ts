import type { AiChatModelDescriptor } from "@quirekit/ai-chat";
import {
  createQuireAiPiDirectRuntime, createQuireAiPiHostRuntime, loadQuireAiPiHostCatalog, type QuireAiPiDirectRuntimeOptions
} from "@quirekit/ai-orchestrator-pi";
import type { QuireAiBrowserModelConfig, QuireAiBrowserProviderCatalog } from "../provider-settings";
import { quireAiDisconnectedModel } from "../responder/disconnected";
import type { QuireAiModelConnection, QuireAiModelConnectionOptions } from "./types";

/**
 * Resolves the models of a workspace from a browser-direct catalog, an AI Host, or neither.
 * An unreachable Host is not an error: the workspace stays disconnected and says so.
 * @param options - Connection sources.
 * @returns Models and their runtime resolver.
 */
export async function resolveQuireAiModelConnection(options: QuireAiModelConnectionOptions = {}): Promise<QuireAiModelConnection> {
  if (options.browserCatalog !== undefined) return browserConnection(options, options.browserCatalog);
  const hostUrl = options.hostUrl?.trim();
  if (hostUrl === undefined || hostUrl.length === 0) return disconnected("local");
  try {
    return await hostConnection(options, hostUrl);
  } catch {
    return disconnected("fallback");
  }
}

/** @param state - Whether no connection was configured or the Host was unreachable. @returns Credential-free connection. */
function disconnected(state: "fallback" | "local"): QuireAiModelConnection {
  return {
    primaryModel: quireAiDisconnectedModel,
    providerStatus: state === "fallback"
      ? { state, label: { "zh-CN": "模型 Host 不可用 · 尚未连接模型", en: "Model Host unavailable · no model connected" } }
      : { state, label: { "zh-CN": "尚未连接模型 · 请配置浏览器直连或可选 Host", en: "No model connected · configure browser-direct or optional Host" } }
  };
}

/**
 * Connects to standard-protocol providers directly from the browser.
 * @param options - Connection options.
 * @param catalog - Validated browser-direct model catalog.
 * @returns Connected models.
 */
function browserConnection(options: QuireAiModelConnectionOptions, catalog: QuireAiBrowserProviderCatalog): QuireAiModelConnection {
  const models = catalog.profiles.map(createModelDescriptor);
  const primaryModel = models.find(model => model.id === catalog.defaultProfileId);
  if (primaryModel === undefined) throw new TypeError("The browser-direct catalog has no default model profile.");
  const runtimes = new Map(catalog.profiles.map(config => [config.id, createQuireAiPiDirectRuntime({
    id: config.id, providerName: config.providerLabel, api: config.protocol, baseUrl: config.baseUrl, modelId: config.model,
    contextWindow: config.contextWindowTokens, maxTokens: config.maxOutputTokens, reasoning: config.thinkingLevel !== "off",
    auth: createModelAuth(config), timeoutMs: 120_000, maxRetries: 2,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch })
  })]));
  return {
    primaryModel,
    availableModels: models.filter(model => model.id !== primaryModel.id),
    resolveAgentRuntime: ({ model }) => {
      const runtime = runtimes.get(model.id);
      if (runtime === undefined) throw new TypeError("The selected browser-direct model is unavailable.");
      return { ...runtime, thinkingLevel: catalog.profiles.find(profile => profile.id === model.id)?.thinkingLevel ?? "off" };
    },
    providerStatus: { state: "connected", label: { "zh-CN": `浏览器直连 · ${models.length} 个模型`, en: `Browser direct · ${models.length} models` } }
  };
}

/**
 * Connects to the model profiles an AI Host publishes.
 * @param options - Connection options.
 * @param hostUrl - Non-empty Host base URL.
 * @returns Connected models; rejects when the catalog cannot be loaded.
 */
async function hostConnection(options: QuireAiModelConnectionOptions, hostUrl: string): Promise<QuireAiModelConnection> {
  const transport = {
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.getHeaders === undefined ? {} : { getHeaders: options.getHeaders })
  };
  const catalog = await loadQuireAiPiHostCatalog({ hostUrl, ...transport });
  const models = catalog.profiles.map(profile => Object.freeze({
    id: profile.id, label: profile.label, provider: profile.provider,
    ...(profile.maxOutputTokens === undefined ? {} : { maxOutputTokens: profile.maxOutputTokens }),
    capabilities: Object.freeze({
      vision: profile.capabilities.vision ?? false,
      ...(profile.capabilities.files === undefined ? {} : { files: profile.capabilities.files }),
      ...(profile.capabilities.reasoning === undefined ? {} : { reasoning: profile.capabilities.reasoning })
    })
  } satisfies AiChatModelDescriptor));
  const primaryModel = models.find(({ id }) => id === catalog.defaultProfileId);
  if (primaryModel === undefined) throw new TypeError("The AI Host catalog has no default profile.");
  const runtimes = new Map(catalog.profiles.map(profile => [profile.id, createQuireAiPiHostRuntime({ hostUrl, profile, ...transport })]));
  return {
    primaryModel,
    availableModels: models.filter(({ id }) => id !== primaryModel.id),
    resolveAgentRuntime: ({ model }) => {
      const runtime = runtimes.get(model.id);
      if (runtime === undefined) throw new TypeError("The selected AI Host Agent profile is unavailable.");
      return runtime;
    },
    providerStatus: { state: "connected", label: { "zh-CN": "已连接模型 Host", en: "Model Host connected" } }
  };
}

/** @param config - Browser-direct model profile. @returns Provider-neutral model descriptor. */
function createModelDescriptor(config: QuireAiBrowserModelConfig): AiChatModelDescriptor {
  return Object.freeze({
    id: config.id, label: config.model, provider: config.providerLabel,
    maxOutputTokens: config.maxOutputTokens, contextWindowTokens: config.contextWindowTokens,
    capabilities: Object.freeze({ vision: false, files: false, reasoning: config.thinkingLevel !== "off" })
  });
}

/** @param config - Browser-direct model profile. @returns Pi authentication for the profile's header scheme. */
function createModelAuth(config: QuireAiBrowserModelConfig): QuireAiPiDirectRuntimeOptions["auth"] {
  return config.authScheme === "api-key"
    ? { apiKey: config.apiKey, headers: { "api-key": config.apiKey, authorization: null } }
    : { apiKey: config.apiKey };
}
