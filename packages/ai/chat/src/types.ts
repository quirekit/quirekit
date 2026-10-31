import type { QuireDocumentChange, QuireDocumentSdk } from "@quirekit/ai-runtime";

/** Capability flags declared by one application-supplied chat model. */
export interface AiChatModelCapabilities {
  /** Whether the model can directly inspect image attachments. */
  readonly vision: boolean;
  /** Whether the model can consume file attachments without preprocessing. */
  readonly files?: boolean | undefined;
  /** Whether the model exposes a reasoning mode to the application adapter. */
  readonly reasoning?: boolean | undefined;
}

/** Provider-neutral model identity shown by the conversation workspace. */
export interface AiChatModelDescriptor {
  /** Stable application model id. */
  readonly id: string;
  /** Human-readable model name. */
  readonly label: string;
  /** Human-readable provider name. */
  readonly provider: string;
  /** Optional provider-admitted completion budget for document authoring turns. */
  readonly maxOutputTokens?: number | undefined;
  /** Optional declared total context window for conversation budgeting. */
  readonly contextWindowTokens?: number | undefined;
  /** Capabilities used for honest routing decisions. */
  readonly capabilities: AiChatModelCapabilities;
}

/** Visible application-owned provider connection state. */
export interface AiChatProviderStatus {
  /** Stable status used only for product presentation. */
  readonly state: "connected" | "fallback" | "local";
  /** Localized safe status label; backend errors must not be displayed here. */
  readonly label: Readonly<Record<"zh-CN" | "en", string>>;
}

/** Application-owned entry point for configuring the active provider connection. */
export interface AiChatProviderSettingsAction {
  /** Opens the application provider settings without transferring credential ownership to Chat. */
  open(): void;
}

/** Application action shown as an icon button in the workspace header, such as a skill library. */
export interface AiChatHeaderAction {
  /** Stable identifier. */
  readonly id: string;
  /** Accessible label and tooltip. */
  readonly label: string;
  /** Icon name from the QuireKit icon registry. */
  readonly icon: string;
  /** Runs the action; the application owns what it opens. */
  run(): void;
}

/** Host-owned persistence boundary for the selected Chat model profile. */
export interface AiChatModelSelectionStore {
  /**
   * Loads the previously selected model id.
   *
   * @returns Persisted model id or undefined when no preference exists.
   */
  loadSelectedModelId(): string | undefined | Promise<string | undefined>;
  /**
   * Persists the selected model id outside the Chat package.
   *
   * @param modelId - Selected application model id.
   */
  saveSelectedModelId(modelId: string): void | Promise<void>;
}

/** Chronological audited execution entry attached to one assistant turn. */
export interface AiChatExecutionTraceEntry {
  /** Stable trace identity within one Agent run. */
  readonly id: string;
  /** Stable Agent run identity. */
  readonly runId: string;
  /** Execution family shown in the timeline. */
  readonly kind: "agent" | "model" | "policy" | "tool-call" | "tool-result" | "editor";
  /** Current lifecycle state. */
  readonly status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  /** Bounded public label. */
  readonly label: string;
  /** Optional bounded public detail. */
  readonly detail?: string | undefined;
  /** Exact model-visible tool name when applicable. */
  readonly toolName?: string | undefined;
  /** Opaque SDK operation identity supplied by the adapter, never inferred from tool names. */
  readonly operationId?: string | undefined;
  /** Redacted and bounded tool arguments when applicable. */
  readonly arguments?: unknown;
  /** Redacted and bounded tool result when applicable. */
  readonly result?: unknown;
  /** ISO start timestamp. */
  readonly startedAt: string;
  /** ISO completion timestamp. */
  readonly finishedAt?: string | undefined;
  /** Measured duration after completion. */
  readonly durationMs?: number | undefined;
  /** Stable safe failure code when applicable. */
  readonly errorCode?: string | undefined;
}

/** Incrementally rendered assistant text in one chronological message slot. */
export interface AiChatContentMessagePart {
  /** Stable part identity within one assistant message. */
  readonly id: string;
  /** Visible assistant-text discriminator. */
  readonly kind: "content";
  /** Text accumulated only while this part remains the active tail part. */
  readonly content: string;
}

/** Raw provider reasoning rendered at its exact arrival position. */
export interface AiChatReasoningMessagePart {
  /** Stable part identity within one assistant message. */
  readonly id: string;
  /** Raw-reasoning discriminator. */
  readonly kind: "reasoning";
  /** Streaming or completed presentation state. */
  readonly status: "streaming" | "available";
  /** Provider-authored reasoning content exactly as received. */
  readonly content: string;
}

/** One audited Agent event rendered at its exact first-arrival position. */
export interface AiChatTraceMessagePart {
  /** Stable part identity derived from the trace identity. */
  readonly id: string;
  /** Audited-trace discriminator. */
  readonly kind: "trace";
  /** Latest immutable snapshot for this trace identity. */
  readonly entry: AiChatExecutionTraceEntry;
}

/** First-arrival slot for an SDK operation, including adapters without trace events. */
export interface AiChatDocumentMessagePart {
  /** Stable chronological slot identity. */
  readonly id: string;
  /** Document operation discriminator. */
  readonly kind: "document";
  /** SDK operation whose current facts belong in this slot. */
  readonly operationId: string;
}

/** Review request anchored where the SDK first asked for a decision. */
export interface AiChatReviewMessagePart {
  /** Stable chronological slot identity. */
  readonly id: string;
  /** Review discriminator. */
  readonly kind: "review";
  /** Retained review identity; settlement does not move the slot. */
  readonly reviewId: string;
}

/** Chronological assistant output part updated only in its original slot. */
export type AiChatMessagePart =
  | AiChatContentMessagePart
  | AiChatReasoningMessagePart
  | AiChatTraceMessagePart
  | AiChatDocumentMessagePart
  | AiChatReviewMessagePart;

/** Conversation message rendered by the workspace. */
export interface AiChatMessage {
  /** Stable message id within one conversation. */
  readonly id: string;
  /** Author role. */
  readonly role: "assistant" | "user";
  /** User plain text or assistant-authored safe Markdown source. */
  readonly content: string;
  /** Ordered raw provider reasoning, text, and audited execution parts. */
  readonly parts?: readonly AiChatMessagePart[] | undefined;
  /** ISO timestamp retained for product persistence adapters. */
  readonly createdAt: string;
  /** Settled presentation state; independent of committed document effects. */
  readonly status?: "pending" | "streaming" | "complete" | "stopped" | "error";
  /** Stable terminal category retained independently for each historical turn. */
  readonly errorCode?: string | undefined;
  /** Whether the assistant turn is still being produced. */
  readonly pending?: boolean | undefined;
}

/** Host-owned authorization preset selected for one AI conversation turn. */
export type AiChatAuthorizationMode =
  | "request-approval"
  | "full-access";

/** Host wording for one authorization preset, already in the product locale. */
export interface AiChatAuthorizationPresentation {
  /** Short label on the composer button and in the menu. */
  readonly label: string;
  /** One-line explanation under the menu label. */
  readonly description: string;
}

/** Durable Host persistence seam for the selected AI authorization preset. */
export interface AiChatAuthorizationModeStore {
  /**
   * Loads the last explicit authorization preset.
   *
   * @returns Persisted preset, or undefined when no preference exists.
   */
  loadAuthorizationMode(): Promise<AiChatAuthorizationMode | undefined>;
  /**
   * Persists one explicit authorization preset.
   *
   * @param mode - Validated Host-owned preset.
   */
  saveAuthorizationMode(mode: AiChatAuthorizationMode): Promise<void>;
}

/** Serializable document event projected by the public SDK. */
export type AiChatDocumentEvent = Parameters<Parameters<QuireDocumentSdk["subscribe"]>[0]>[0];
/** Authoritative operation facts, independent of model or presentation success. */
export type AiChatDocumentOperation = Extract<AiChatDocumentEvent, { type: "operation" }>["operation"];
/** Candidate facts owned by the document SDK, never by the UI. */
export type AiChatEditPreview = Extract<AiChatDocumentEvent, { type: "preview" }>["preview"];
/** Explicit user decision; this alone does not prove a commit. */
export type AiChatEditPreviewDecision = "approved" | "rejected";
/** Retained review state associated with its originating message. */
export interface AiChatReview {
  /** Stable source message identity. */
  readonly messageId: string;
  /** Complete serialized candidate and source supplied by the SDK. */
  readonly preview: AiChatEditPreview;
  /** User decision, or pending while no decision was made. */
  readonly state: "pending" | "approved" | "rejected" | "expired";
}
/** Thin application adapter to a persistent harness session. */
export interface AiChatResponder {
  /** Run against the public document SDK; never reconstruct native history from UI messages.
   * @param request - Captured turn and its observers.
   * @returns Settled harness output.
   */
  respond(request: AiChatResponderRequest): Promise<AiChatResponderResult>;
  /** Start a fresh native conversation after the current run settles. */
  reset(): void | Promise<void>;
  /** Release the harness session during product destruction. */
  destroy(): void | Promise<void>;
}
/** Immutable request passed to a model adapter. */
export interface AiChatResponderRequest {
  /** Product-assigned turn identity, separate from SDK operation identities. */
  readonly id: string;
  /** Literal user request. */
  readonly prompt: string;
  /** Selected application model. */
  readonly model: AiChatModelDescriptor;
  /** Authorization preset frozen for this turn. */
  readonly authorizationMode: AiChatAuthorizationMode;
  /** Public document capability port. */
  readonly document: QuireDocumentSdk;
  /** Selection and revision captured before asynchronous model resolution. */
  readonly requestId: string;
  /** Cancellation authority for this turn. */
  readonly signal: AbortSignal;
  /** Streamed assistant content. */
  readonly onContentDelta: (content: string) => void;
  /** Provider-supplied visible reasoning. */
  readonly onReasoningDelta: (content: string) => void;
  /** Sanitized harness progress. */
  readonly onTrace: (entry: AiChatExecutionTraceEntry) => void;
}
/** Settled harness output; document effects are reported separately by the SDK. */
export interface AiChatResponderResult {
  /** Final assistant response. */
  readonly content: string;
  /** Durable harness session identity when available. */
  readonly sessionId?: string;
}
/** Application-owned configuration for one independent conversation controller. */
export interface AiChatWorkspaceOptions {
  /** Public document capability port bound to this editor instance. */
  readonly document: QuireDocumentSdk;
  /** Persistent harness adapter for this conversation. */
  readonly responder: AiChatResponder;
  /** Initial model. */
  readonly primaryModel: AiChatModelDescriptor;
  /** Other configured models. */
  readonly availableModels?: readonly AiChatModelDescriptor[];
  /** Optional model preference storage. */
  readonly modelSelectionStore?: AiChatModelSelectionStore;
  /** Initial write policy; defaults to approval. */
  readonly defaultAuthorizationMode?: AiChatAuthorizationMode;
  /** Host wording for presets whose effect the generic labels do not describe. */
  readonly authorizationPresentation?: Partial<Record<AiChatAuthorizationMode, AiChatAuthorizationPresentation>>;
  /** Optional authorization preference storage. */
  readonly authorizationModeStore?: AiChatAuthorizationModeStore;
  /** Safe connection presentation. */
  readonly providerStatus?: AiChatProviderStatus;
  /** Application connection settings entry. */
  readonly providerSettings?: AiChatProviderSettingsAction;
  /** Application actions shown in the header before the connection settings. */
  readonly headerActions?: readonly AiChatHeaderAction[];
  /** Product title. */
  readonly title?: string;
  /**
   * Conversation shown when the controller starts, taken from an earlier controller's snapshot
   * (the same document reopened). Unsettled reviews become expired and unfinished replies stopped:
   * their candidates belonged to the earlier document SDK. Model memory belongs to the responder.
   */
  readonly restore?: AiChatRestoredConversation;
  /** Shows raw view and structure differences on review cards, for developers. */
  readonly diagnostics?: boolean;
  /**
   * Shows one listed change in the document; omitted leaves the list static.
   * @param review - Review holding the change; its state tells which document is current.
   * @param change - Change to show.
   */
  readonly locateChange?: (review: AiChatReview, change: QuireDocumentChange) => void;
  /**
   * Resolves an image a review card shows for a changed object; omitted lists such objects by name only.
   * @param source - Host media reference of the presented image.
   * @returns Displayable image, released by the card when it stops showing it, or null when it cannot be shown.
   */
  readonly resolveImage?: (source: unknown) => Promise<AiChatImage | null>;
}

/** Displayable image a host lends a review card. */
export interface AiChatImage {
  /** URL an image element can show. */
  readonly url: string;
  /** Frees the URL once the card no longer shows it. */
  release(): void;
}
/** Immutable presentation snapshot, independent of Vue and panel lifetime. */
export interface AiChatSnapshot {
  /** Identity of the displayed conversation. */
  readonly conversationId: string;
  /** Current editable draft, preserved while generation runs. */
  readonly draft: string;
  /** Ordered visible messages; never used as model authority. */
  readonly messages: readonly AiChatMessage[];
  /** Available model profiles. */
  readonly models: readonly AiChatModelDescriptor[];
  /** Selected model identity. */
  readonly selectedModelId: string;
  /** Next-turn write policy, immutable while a turn is active. */
  readonly authorizationMode: AiChatAuthorizationMode;
  /** Whether a run or session reset is in flight. */
  readonly pending: boolean;
  /** Full candidate review history for this conversation. */
  readonly reviews: readonly AiChatReview[];
  /** SDK events retaining committed effects even when the model later fails. */
  readonly documentEvents: readonly AiChatDocumentEvent[];
  /** Owning assistant message for each observed document operation. */
  readonly operationMessageIds: Readonly<Record<string, string>>;
  /** Localized presentation uses this typed terminal failure category. */
  readonly errorCode?: string | undefined;
}
/** Displayed conversation a new controller continues from. */
export type AiChatRestoredConversation = Pick<AiChatSnapshot, "conversationId" | "messages" | "reviews" | "documentEvents" | "operationMessageIds">;

/** Headless controller retained by the product, never by a mounted component. */
export interface AiChatController {
  /** Stable application configuration. */
  readonly options: AiChatWorkspaceOptions;
  /** Read the current immutable projection.
   * @returns Snapshot for a framework adapter.
   */
  getSnapshot(): AiChatSnapshot;
  /** Observe presentation state. Disposing a subscription never cancels execution.
   * @param listener - Snapshot observer.
   * @returns Subscription disposal function.
   */
  subscribe(listener: (snapshot: AiChatSnapshot) => void): () => void;
  /** Update the controlled draft.
   * @param text - Literal composer content.
   */
  setDraft(text: string): void;
  /** Select and persist a model for the next turn.
   * @param id - Configured model identity.
   */
  selectModel(id: string): void;
  /** Select and persist a write preset for the next turn.
   * @param mode - Explicit product policy.
   */
  selectAuthorizationMode(mode: AiChatAuthorizationMode): void;
  /** Capture the current target synchronously, then submit the draft.
   * @returns Completion of this turn, with errors retained in the snapshot.
   */
  submit(): Promise<void>;
  /** Cancel an active turn without discarding already committed document effects. */
  stop(): void;
  /** Decide one SDK-owned candidate.
   * @param id - Stable preview identity.
   * @param decision - Explicit user choice.
   * @returns Whether the SDK accepted the decision.
   */
  decidePreview(id: string, decision: AiChatEditPreviewDecision): boolean;
  /** Reset both display and native harness history after cancellation settles.
   * @returns Completion of the fresh conversation initialization.
   */
  reset(): Promise<void>;
  /** Release the document binding and harness at final product teardown.
   * @returns Completion of resource release.
   */
  destroy(): Promise<void>;
}
