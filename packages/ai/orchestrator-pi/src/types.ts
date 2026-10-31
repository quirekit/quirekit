import type {
  AgentMessage,
  Session,
  ThinkingLevel
} from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";
import type { QuireDocumentSdk } from "@quirekit/ai-runtime";

/** Auditable trace entry kind emitted by the coordinator. */
export type QuireAiAgentTraceKind =
  | "agent"
  | "model"
  | "tool-call"
  | "tool-result";

/** Auditable trace lifecycle state. */
export type QuireAiAgentTraceStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

/** One immutable trace snapshot suitable for ordered UI upsert. */
export interface QuireAiAgentTraceEntry {
  /** Stable event identity inside one run. */
  readonly id: string;
  /** Stable run identity. */
  readonly runId: string;
  /** Execution family. */
  readonly kind: QuireAiAgentTraceKind;
  /** Current lifecycle state. */
  readonly status: QuireAiAgentTraceStatus;
  /** Bounded public label. */
  readonly label: string;
  /** Optional bounded public detail. */
  readonly detail?: string | undefined;
  /** Exact model-visible Tool name when applicable. */
  readonly toolName?: string | undefined;
  /** Opaque SDK operation identity shared with document events and commit receipts. */
  readonly operationId?: string | undefined;
  /** Parsed Tool arguments with credential-like fields redacted. */
  readonly arguments?: unknown;
  /** Tool-owned result details with credential-like fields redacted. */
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

/** Observes ordered trace snapshots without changing Agent authority. */
export type QuireAiAgentTraceObserver = (
  entry: QuireAiAgentTraceEntry
) => void;

/** Append-only lifecycle event for one provider Tool-call argument stream. */
export type QuireAiPiToolCallStreamEvent =
  | Readonly<{
      /** Tool-call stream started. */
      type: "start";
      /** Provider-issued Tool-call identity. */
      toolCallId: string;
      /** Exact model-visible Tool name. */
      toolName: string;
    }>
  | Readonly<{
      /** Another JSON argument fragment arrived. */
      type: "delta";
      /** Provider-issued Tool-call identity. */
      toolCallId: string;
      /** Exact model-visible Tool name. */
      toolName: string;
      /** Raw append-only JSON argument fragment. */
      delta: string;
    }>
  | Readonly<{
      /** Tool-call arguments reached their complete provider boundary. */
      type: "end";
      /** Provider-issued Tool-call identity. */
      toolCallId: string;
      /** Exact model-visible Tool name. */
      toolName: string;
    }>;

/** Observes raw Tool-call argument ordering without execution authority. */
export type QuireAiPiToolCallStreamObserver = (
  event: QuireAiPiToolCallStreamEvent
) => void;

/** Inputs appended to one persistent native Pi conversation. */
export interface QuireAiPiRunRequest {
  /** Stable caller-owned run id. */
  readonly id: string;
  /** Current user instruction. */
  readonly prompt: string;
  /** Public document authority used by every registered tool. */
  readonly document: QuireDocumentSdk;
  /** Request target captured before asynchronous runtime resolution. */
  readonly requestId?: string | undefined;
  /** Optional profile change, preserving this conversation's transcript. */
  readonly runtime?: QuireAiPiModelRuntime | undefined;
  /** Updated instruction derived from the currently available document tools. */
  readonly systemPrompt?: string | undefined;
  /** Caller-owned cancellation signal forwarded to Pi and every Tool. */
  readonly signal: AbortSignal;
  /** Incremental final-answer observer. */
  readonly onContentDelta?: ((content: string) => void) | undefined;
  /** Incremental raw provider-reasoning observer. */
  readonly onReasoningDelta?: ((content: string) => void) | undefined;
  /** Raw append-only Tool-call argument observer. */
  readonly onToolCallStream?: QuireAiPiToolCallStreamObserver | undefined;
  /** Ordered auditable trace observer. */
  readonly onTrace?: QuireAiAgentTraceObserver | undefined;
}

/** Successful result of one complete native Pi Agent run. */
export interface QuireAiPiRunResult {
  /** Final visible assistant response. */
  readonly content: string;
  /** Durable native Pi conversation identity. */
  readonly sessionId: string;
  /** Durable Pi operation identity supplied by the caller. */
  readonly operationId: string;
  /** Successful terminal state, never used for cancelled or budget-limited runs. */
  readonly status: "completed";
}

/** Real Pi model runtime selected by an application or Host profile. */
export interface QuireAiPiModelRuntime {
  /** Pi provider collection, including its authentication and request policies. */
  readonly models: Models;
  /** Pi model passed unchanged to the Agent. */
  readonly model: Model<Api>;
  /** Pi provider stream function passed unchanged to Agent. */
  readonly streamFn: Models["streamSimple"];
  /** Optional Pi-native thinking level. */
  readonly thinkingLevel?: ThinkingLevel | undefined;
}

/** Construction options for one profile-bound Pi coordinator. */
export interface QuireAiPiCoordinatorOptions extends QuireAiPiModelRuntime {
  /** Application-owned instruction based on the actually mounted Tools. */
  readonly systemPrompt: string;
  /** Maximum idle interval within a provider request; human approval is excluded. */
  readonly timeoutMs?: number | undefined;
  /** Maximum model turns admitted before a still-running Tool loop fails closed. */
  readonly maxModelTurns?: number | undefined;
  /** Consecutive turns without document progress that stop the run early; default unlimited within maxModelTurns. */
  readonly maxIdleTurns?: number | undefined;
  /** Opens stored native state, or creates a new conversation after reset. */
  readonly openSession?: ((request: QuireAiPiSessionOpenRequest) => Promise<Session>) | undefined;
}

/** Explicit session-opening intent supplied to an application persistence adapter. */
export interface QuireAiPiSessionOpenRequest {
  /** True after reset; the adapter must create a new conversation. */
  readonly fresh: boolean;
  /** Previous conversation identity when replacing an existing session. */
  readonly previousSessionId?: string | undefined;
}

/** Application-facing coordinator contract around one native Pi Agent. */
export interface QuireAiAgentCoordinator {
  /**
   * Appends a prompt to native session state and lets Pi drive the complete run.
   *
   * @param request - Prompt, native Tools, cancellation, and observers.
   * @returns Final visible Pi response.
   */
  run(request: QuireAiPiRunRequest): Promise<QuireAiPiRunResult>;
  /** Aborts the active run and clears Pi queues. */
  abort(): void;
  /** Waits until the active run and event subscribers settle. */
  waitForIdle(): Promise<void>;
  /** Starts a new conversation after cancelling and settling current work. */
  reset(): Promise<void>;
  /** Closes this coordinator and its session handle after settlement. */
  close(): Promise<void>;
  /** @returns Complete native messages, including tool calls, results and signatures. */
  getTranscript(): Promise<readonly AgentMessage[]>;
  /** @returns Native session identity, initializing the session when necessary. */
  getSessionId(): Promise<string>;
}
