import type { AiChatModelDescriptor, AiChatProviderStatus, AiChatResponderRequest } from "@quirekit/ai-chat";
import type { QuireAiPiHostHeaderResolver, QuireAiPiModelRuntime } from "@quirekit/ai-orchestrator-pi";
import type { QuireAiBrowserProviderCatalog } from "../provider-settings";

/** Resolves the Pi model runtime for the model selected in a request. */
export type QuireAiRuntimeResolver = (request: AiChatResponderRequest) => QuireAiPiModelRuntime | Promise<QuireAiPiModelRuntime>;

/** Where models come from: a browser-direct catalog, an AI Host, or neither. */
export interface QuireAiModelConnectionOptions {
  /** AI Host base URL; empty keeps the assistant disconnected. */
  readonly hostUrl?: string | undefined;
  /** Browser-direct model catalog; takes precedence over the Host. */
  readonly browserCatalog?: QuireAiBrowserProviderCatalog | undefined;
  /** Fetch implementation for tests or an application gateway. */
  readonly fetch?: typeof globalThis.fetch | undefined;
  /** Lazy resolver for application authentication headers sent to the Host. */
  readonly getHeaders?: QuireAiPiHostHeaderResolver | undefined;
}

/** Models a workspace offers and how to reach them. */
export interface QuireAiModelConnection {
  /** Initially selected model. */
  readonly primaryModel: AiChatModelDescriptor;
  /** Other configured models. */
  readonly availableModels?: readonly AiChatModelDescriptor[] | undefined;
  /** Model runtime resolver; absent while no model is connected. */
  readonly resolveAgentRuntime?: QuireAiRuntimeResolver | undefined;
  /** Safe visible connection state. */
  readonly providerStatus: AiChatProviderStatus;
}

/** Runtime sources used to resolve the AI Host URL. */
export interface QuireAiHostUrlSources {
  /** Current browser query string, including or excluding the leading question mark. */
  readonly search: string;
  /** Optional build-time fallback supplied by the embedding application. */
  readonly environmentHostUrl?: string | undefined;
  /** Optional application gateway fallback used only when explicitly supplied. */
  readonly defaultHostUrl?: string | undefined;
}
