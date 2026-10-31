/** Connection family selected in AI settings. */
export type QuireAiProviderConnectionMode = "browser" | "host" | "local";

/** Standard HTTP protocol used by one browser-direct model profile. */
export type QuireAiProviderProtocol =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages";

/** Credential header emitted by one browser-direct model profile. */
export type QuireAiProviderAuthScheme = "bearer" | "x-api-key" | "api-key";

/** Pi-native thinking level for one browser-direct model. */
export type QuireAiBrowserThinkingLevel = "off" | "high" | "max";

/** Validated browser-direct model profile. */
export interface QuireAiBrowserModelConfig {
  /** Stable application profile id. */
  readonly id: string;
  /** Standard upstream API protocol. */
  readonly protocol: QuireAiProviderProtocol;
  /** Compatible API base URL or complete protocol endpoint. */
  readonly baseUrl: string;
  /** Credential header style. */
  readonly authScheme: QuireAiProviderAuthScheme;
  /** Optional credential retained only by the browser configuration store. */
  readonly apiKey: string;
  /** Exact upstream model id. */
  readonly model: string;
  /** Provider label shown in the model picker and status surface. */
  readonly providerLabel: string;
  /** Maximum completion tokens admitted for one model turn. */
  readonly maxOutputTokens: number;
  /** Declared total model context window. */
  readonly contextWindowTokens: number;
  /** Percentage of the context window targeted before local compaction. */
  readonly contextBudgetPercent: number;
  /** Pi-native thinking level. */
  readonly thinkingLevel: QuireAiBrowserThinkingLevel;
}

/** Browser-direct catalog resolved for one page lifetime. */
export interface QuireAiBrowserProviderCatalog {
  /** Profile selected when no saved chat choice exists. */
  readonly defaultProfileId: string;
  /** Every validated browser-direct model profile. */
  readonly profiles: readonly QuireAiBrowserModelConfig[];
}

/** Editable browser-direct model profile shown by the settings surface. */
export type QuireAiBrowserModelDraft = QuireAiBrowserModelConfig;

/** Editable local provider settings shown by the configuration surface. */
export interface QuireAiProviderSettingsDraft {
  /** Selected connection family. */
  readonly mode: QuireAiProviderConnectionMode;
  /** Browser-direct model profiles. */
  readonly profiles: readonly QuireAiBrowserModelDraft[];
  /** Default browser-direct model profile id. */
  readonly defaultProfileId: string;
  /** Optional QuireKit AI Host URL. */
  readonly hostUrl: string;
}

/** Persisted non-secret browser-direct model profile. */
export interface QuireAiPersistedModelProfile {
  /** Stable application profile id. */
  readonly id: string;
  /** Standard upstream API protocol. */
  readonly protocol: QuireAiProviderProtocol;
  /** Compatible API base URL. */
  readonly baseUrl: string;
  /** Credential header style. */
  readonly authScheme: QuireAiProviderAuthScheme;
  /** Exact upstream model id. */
  readonly model: string;
  /** Visible provider label. */
  readonly providerLabel: string;
  /** Maximum output token budget. */
  readonly maxOutputTokens: number;
  /** Declared total context window. */
  readonly contextWindowTokens: number;
  /** Target context utilization percentage. */
  readonly contextBudgetPercent: number;
  /** Pi-native thinking level. */
  readonly thinkingLevel: QuireAiBrowserThinkingLevel;
}

/** Persisted non-secret settings document. */
export interface QuireAiPersistedProviderSettings {
  /** Storage format version. */
  readonly version: 4;
  /** Selected connection family. */
  readonly mode: QuireAiProviderConnectionMode;
  /** Persisted browser-direct model profiles without credentials. */
  readonly profiles: readonly QuireAiPersistedModelProfile[];
  /** Default browser-direct profile id. */
  readonly defaultProfileId: string;
  /** Optional QuireKit AI Host URL. */
  readonly hostUrl: string;
}

/** Bootstrap connection resolved before the AI workspace is assembled. */
export type QuireAiResolvedProviderConnection =
  | {
      /** Browser-direct connection discriminator. */
      readonly mode: "browser";
      /** Validated browser-direct model catalog. */
      readonly catalog: QuireAiBrowserProviderCatalog;
    }
  | {
      /** Host-proxy connection discriminator. */
      readonly mode: "host";
      /** Versioned QuireKit AI Host base URL. */
      readonly hostUrl: string;
    }
  | {
      /** Credential-free deterministic validation discriminator. */
      readonly mode: "local";
    };

/** Settings action and initial connection snapshot. */
export interface QuireAiProviderSettingsHandle {
  /** Opens the settings surface. */
  open(): void;
  /** Resolved connection used for the current page lifetime. */
  readonly connection: QuireAiResolvedProviderConnection;
  /** Releases the mounted settings surface. */
  destroy(): void;
}

/** Browser storage authorities used by local provider configuration. */
export interface QuireAiProviderSettingsStorage {
  /** Cross-reload public settings and separately stored credentials. */
  readonly local: Storage;
}

/** Provider settings bootstrap dependencies. */
export interface CreateQuireAiProviderSettingsOptions {
  /** Document that owns the modal surface. */
  readonly ownerDocument: Document;
  /** Default Host URL used only when no explicit settings exist. */
  readonly defaultHostUrl: string;
  /** Browser-local provider settings store. */
  readonly storage: QuireAiProviderSettingsStorage;
  /** Reconnects the application after the validated configuration changes. */
  readonly reconnect: () => void;
  /** Host-managed persistence; when present, provider credentials never enter browser storage. */
  readonly persistence?: QuireAiProviderSettingsPersistence | undefined;
}

/** Application-owned settings persistence: a team administrator surface or one person's own models kept by the host. */
export interface QuireAiProviderSettingsPersistence {
  /** Whose models these are, which the dialog wording follows; defaults to the team. */
  readonly scope?: "team" | "personal" | undefined;
  /** Editable server snapshot; a host may mask stored credentials. */
  readonly initialDraft: QuireAiProviderSettingsDraft;
  /** Validates permissions and saves the complete draft; rejects to keep the form open. @param draft - Validated settings. */
  save(draft: QuireAiProviderSettingsDraft): Promise<void>;
  /** Clears the host configuration; rejects to keep the form open. */
  clear(): Promise<void>;
}

/** Built-in editable provider preset shown in AI settings. */
export interface QuireAiProviderPreset {
  /** Stable preset identity. */
  readonly id: string;
  /** Visible provider and model label. */
  readonly label: string;
  /** Default standard protocol. */
  readonly protocol: QuireAiProviderProtocol;
  /** Official default API base URL. */
  readonly baseUrl: string;
  /** Default credential header style. */
  readonly authScheme: QuireAiProviderAuthScheme;
  /** Default upstream model id. */
  readonly model: string;
  /** Default provider label. */
  readonly providerLabel: string;
  /** Default total context window. */
  readonly contextWindowTokens: number;
  /** Default Pi-native thinking level. */
  readonly thinkingLevel: QuireAiBrowserModelDraft["thinkingLevel"];
}
