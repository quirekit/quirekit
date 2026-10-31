import type { QuireAiEditPreviewDecision, QuireAiToolWriteReceipt } from "../../tool-host";
import type { DocumentRequestState } from "../requests/types";
import type { QuireDocumentEvent } from "../types";

/** Ports the engine-neutral SDK shell hands to the engine it is built on. */
export interface QuireDocumentSdkEnginePorts {
  /**
   * Publishes one detached protocol fact.
   * @param event - Fact to publish.
   */
  readonly emit: (event: QuireDocumentEvent) => void;
  /**
   * Records one canonical commit on its logical operation.
   * @param receipt - Commit receipt.
   */
  readonly receipt: (receipt: QuireAiToolWriteReceipt) => void;
}

/** Request lifecycle owned by an engine: capture with mapped selection, lookup and release. */
export interface QuireDocumentSdkEngineRequests {
  /** @returns A fresh request with its original selection and mounted tools. */
  capture(): DocumentRequestState;
  /** @param id - Request identity. @returns Live request state. */
  get(id: string): DocumentRequestState;
  /** @param id - Request identity to release. */
  release(id: string): void;
  /** Drops every request and detaches from the editor. */
  destroy(): void;
}

/** Review lifecycle owned by an engine. */
export interface QuireDocumentSdkEnginePreviews {
  /** @param id - Pending review. @param decision - User decision. @returns Whether a pending review was resolved. */
  decide(id: string, decision: QuireAiEditPreviewDecision): boolean;
  /** @param requestId - Finished request. @returns Whether one review of its changes was opened. */
  present(requestId: string): boolean;
  /** Settles every pending review as cancelled. */
  destroy(): void;
}

/** Document engine below the SDK shell: the editor lifetime, requests and reviews of one document model. */
export interface QuireDocumentSdkEngine {
  /** @returns Whether the underlying editor is still alive. */
  isOpen(): boolean;
  /** @returns Whether the editor currently accepts writes; read-only editors list only reading tools. */
  isEditable(): boolean;
  /** Identity that serializes writes across every SDK of the same editor. */
  readonly writeKey: object;
  /** Request store. */
  readonly requests: QuireDocumentSdkEngineRequests;
  /** Review store. */
  readonly previews: QuireDocumentSdkEnginePreviews;
  /**
   * @param listener - Called once when the editor is destroyed.
   * @returns Detaches the listener.
   */
  onDestroy(listener: () => void): () => void;
  /** Releases engine resources not covered by requests and previews. */
  destroy(): void;
}

/** Engine-neutral SDK options. */
export interface QuireDocumentSdkShellOptions {
  /** Stable application document identity. */
  readonly documentId: string;
  /** Optional read policy applied before document data is exposed. */
  readonly authorizeRead?: ((toolName: string) => boolean) | undefined;
  /** Rewrites internal ids in assistant text into words people understand. */
  readonly presentReply?: ((text: string, language: "zh" | "en") => string) | undefined;
}
