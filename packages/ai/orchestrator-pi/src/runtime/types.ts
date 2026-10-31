import type {
  ModelAuth,
  ProviderHeaders
} from "@earendil-works/pi-ai";
import type { QuireAiPiModelRuntime } from "../types";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

/** Pi APIs admitted for QuireKit browser-direct model profiles. */
export type QuireAiPiDirectApi =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages";

/** Configuration for one Pi-native browser-direct runtime. */
export interface QuireAiPiDirectRuntimeOptions {
  /** Stable application profile and Pi provider id. */
  readonly id: string;
  /** Human-readable provider label. */
  readonly providerName: string;
  /** Pi-native model API. */
  readonly api: QuireAiPiDirectApi;
  /** Provider API base URL. */
  readonly baseUrl: string;
  /** Upstream model id. */
  readonly modelId: string;
  /** Model context window. */
  readonly contextWindow: number;
  /** Maximum output tokens per provider turn. */
  readonly maxTokens: number;
  /** Whether the model supports provider reasoning. */
  readonly reasoning: boolean;
  /** Pi-native authentication resolved anew for each request when a function is supplied. */
  readonly auth: ModelAuth | (() => ModelAuth | Promise<ModelAuth>);
  /** Explicit model input capabilities. */
  readonly input?: readonly ("text" | "image")[] | undefined;
  /** Initial thinking selection, separate from whether reasoning is supported. */
  readonly thinkingLevel?: ThinkingLevel | undefined;
  /** Optional provider-level static headers. */
  readonly headers?: ProviderHeaders | undefined;
  /** Optional injected fetch implementation. */
  readonly fetch?: typeof globalThis.fetch | undefined;
  /** Optional provider request timeout. */
  readonly timeoutMs?: number | undefined;
  /** Optional provider-owned retry count. */
  readonly maxRetries?: number | undefined;
}

/** Resolves additional headers for Pi Host catalog and message requests. */
export type QuireAiPiHostHeaderResolver = () =>
  | HeadersInit
  | Promise<HeadersInit>;

/** Safe model capability flags disclosed by one Host profile. */
export interface QuireAiPiHostProfileCapabilities {
  /** Whether the profile accepts visual input. */
  readonly vision?: boolean | undefined;
  /** Whether the profile accepts file input. */
  readonly files?: boolean | undefined;
  /** Whether the profile exposes reasoning. */
  readonly reasoning?: boolean | undefined;
}

/** Sanitized Host profile used to construct a Pi `pi-messages` model. */
export interface QuireAiPiHostProfile {
  /** Stable Host routing id. */
  readonly id: string;
  /** Human-readable profile label. */
  readonly label: string;
  /** Human-readable provider label. */
  readonly provider: string;
  /** Safe upstream model identifier. */
  readonly model: string;
  /** Optional model context window. */
  readonly contextWindowTokens?: number | undefined;
  /** Optional completion budget. */
  readonly maxOutputTokens?: number | undefined;
  /** Public model capability flags. */
  readonly capabilities: QuireAiPiHostProfileCapabilities;
}

/** Sanitized versioned profile catalog returned by a Pi Provider Host. */
export interface QuireAiPiHostCatalog {
  /** Host catalog version. */
  readonly version: 1;
  /** Initial profile id. */
  readonly defaultProfileId: string;
  /** Safe available profiles. */
  readonly profiles: readonly QuireAiPiHostProfile[];
}

/** Configuration for loading the safe Pi Host profile catalog. */
export interface QuireAiPiHostCatalogOptions {
  /** HTTP(S) base URL of the application-owned Host. */
  readonly hostUrl: string;
  /** Optional injected fetch implementation. */
  readonly fetch?: typeof globalThis.fetch | undefined;
  /** Optional lazy application authentication headers. */
  readonly getHeaders?: QuireAiPiHostHeaderResolver | undefined;
  /** Optional caller cancellation signal. */
  readonly signal?: AbortSignal | undefined;
}

/** Configuration for one Pi `pi-messages` client runtime. */
export interface QuireAiPiHostRuntimeOptions {
  /** HTTP(S) base URL of the application-owned Host. */
  readonly hostUrl: string;
  /** Sanitized Host profile selected by the application. */
  readonly profile: QuireAiPiHostProfile;
  /** Optional injected fetch implementation. */
  readonly fetch?: typeof globalThis.fetch | undefined;
  /** Optional lazy application authentication headers. */
  readonly getHeaders?: QuireAiPiHostHeaderResolver | undefined;
  /** Optional provider request timeout. */
  readonly timeoutMs?: number | undefined;
  /** Optional provider-owned retry count. */
  readonly maxRetries?: number | undefined;
}

/** Transport and budget policy applied below Pi's provider collection. */
export interface QuireAiPiRequestPolicy {
  /** Optional application fetch implementation. */
  readonly fetch?: typeof globalThis.fetch | undefined;
  /** Optional provider request timeout. */
  readonly timeoutMs?: number | undefined;
  /** Optional provider retry bound. */
  readonly maxRetries?: number | undefined;
  /** Optional model output ceiling. */
  readonly maxTokens?: number | undefined;
}
