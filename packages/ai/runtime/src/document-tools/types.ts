import type { Static, TSchema } from "typebox";

/** JSON value accepted by the public document protocol. */
export type QuireDocumentJsonValue = null | boolean | number | string
  | readonly QuireDocumentJsonValue[]
  | { readonly [key: string]: QuireDocumentJsonValue };

/** Request-owned range supplied only to trusted feature handlers. */
export interface QuireDocumentToolSelection {
  /** Mapped start in the current editor document. */
  readonly from: number;
  /** Mapped end in the current editor document. */
  readonly to: number;
}

/** Detached progress that cannot mutate the canonical document. */
export interface QuireDocumentToolProgress {
  /** Human-readable description of current work. */
  readonly summary?: string;
  /** Serializable candidate owned by the feature. */
  readonly draft?: unknown;
  /** Units of work finished, for work counted in parts. */
  readonly done?: number;
  /** Units of work in total, alongside `done`. */
  readonly total?: number;
}

/** Execution authority supplied by the SDK, never by model arguments. */
export interface QuireDocumentToolContext {
  /** Stable document operation identity, independent of a provider call identifier. */
  readonly callId: string;
  /** Captured request (conversation turn) the call belongs to. */
  readonly requestId?: string | undefined;
  /** Cooperative cancellation signal owned by the invocation. */
  readonly signal: AbortSignal;
  /** Mapped request selection; null means invalidated and must never fall back to the live cursor. */
  readonly selection?: QuireDocumentToolSelection | null;
  /** Receives detached progress without crossing the command boundary. */
  readonly onProgress?: (progress: QuireDocumentToolProgress) => void;
}

/** Serializable description shared by direct clients and Agent adapters. */
export interface QuireDocumentToolDescriptor<Parameters extends TSchema = TSchema> {
  /** Stable name within the mounted document tool set. */
  readonly name: string;
  /** Human-readable tool label. */
  readonly label: string;
  /** Model-facing semantic contract and limits. */
  readonly description: string;
  /** JSON input schema, also used for local validation. */
  readonly parameters: Parameters;
  /** Optional domain result schema for consumer validation. */
  readonly outputSchema?: TSchema;
  /** Document side-effect class; writes are serialized at the editor boundary. */
  readonly effect: "read" | "write";
}

/** Domain result returned unchanged to every integration. */
export interface QuireDocumentToolResult<Value = unknown> {
  /** JSON-serializable domain result and any committed receipt. */
  readonly value: Value;
  /** Model-visible explanation of the actual result. */
  readonly summary: string;
}

/** Feature-owned semantic tool with no model-runtime dependency. */
export interface QuireDocumentTool<Parameters extends TSchema = TSchema, Value = unknown>
  extends QuireDocumentToolDescriptor<Parameters> {
  /** Executes through typed commands. @param input - Validated arguments. @param context - Trusted authority. @returns Domain result. */
  execute(input: Static<Parameters>, context: QuireDocumentToolContext): Promise<QuireDocumentToolResult<Value>>;
  /** Observes incomplete input. @param input - Partial arguments. @param context - Trusted authority. */
  observeInput?(input: unknown, context: QuireDocumentToolContext): void;
}
