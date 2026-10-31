import type { Node } from "@quirekit/pm";
import type {
  QuireAiEditPreviewDecision, QuireAiSemanticRef, QuireAiToolHost,
  QuireAiToolHostOptions, QuireAiToolWriteReceipt
} from "../tool-host";
import type {
  QuireDocumentTool, QuireDocumentToolDescriptor, QuireDocumentToolProgress,
  QuireDocumentToolResult
} from "../document-tools";
import type { QuireAiPresentedImage } from "@quirekit/ai-contract";

/** Serializable request identity; its selection remains private to the SDK. */
export interface QuireDocumentRequest {
  /** Opaque request identity issued by this SDK instance. */
  readonly id: string;
  /** Application document identity. */
  readonly documentId: string;
  /** Document endpoint at request capture. */
  readonly documentRevision: string;
}

/** Engine-neutral tool invocation, suitable for JSON transport. */
export interface QuireDocumentInvocation {
  /** Name discovered from this request's mounted tools. */
  readonly toolName: string;
  /** Arguments validated against the feature input schema. */
  readonly input: unknown;
  /** Idempotency identity chosen by the caller for this logical operation. */
  readonly operationId: string;
  /** Captured request identity; omission creates a short-lived request. */
  readonly requestId?: string;
}

/** Local execution controls kept outside the JSON transport payload. */
export interface QuireDocumentInvocationOptions {
  /** Optional caller-owned cancellation signal. */
  readonly signal?: AbortSignal;
}

/** Stable public failure information. */
export interface QuireDocumentFailure {
  /** Machine-readable failure classification. */
  readonly code: string;
  /** Safe explanation for the caller. */
  readonly message: string;
}

/** Observable operation state independent from whether a document was committed. */
export interface QuireDocumentOperation {
  /** Logical operation identity. */
  readonly id: string;
  /** Application document identity. */
  readonly documentId: string;
  /** Invoked semantic tool. */
  readonly toolName: string;
  /** Current execution state. */
  readonly status: "running" | "completed" | "cancelled" | "failed";
  /** True when at least one canonical document change was committed. */
  readonly committed: boolean;
  /** All actual commits, preserved even after cancellation or failure. */
  readonly receipts: readonly QuireAiToolWriteReceipt[];
  /** Successful JSON result, if available. */
  readonly result?: QuireDocumentToolResult;
  /** Safe terminal failure, if present. */
  readonly error?: QuireDocumentFailure;
}

/** Serializable detached candidate; it never exposes ProseMirror objects. */
export interface QuireDocumentPreview {
  /** Identity passed to decidePreview. */
  readonly id: string;
  /** Logical operation waiting for a decision. */
  readonly operationId: string;
  /** Application document identity. */
  readonly documentId: string;
  /** Feature-owned capability. */
  readonly capabilityId: string;
  /** Semantic target represented by the candidate. */
  readonly target: QuireAiSemanticRef;
  /** Exact source revision checked again before commit. */
  readonly sourceDocumentRevision: string;
  /** Canonical source serialized as document JSON. */
  readonly sourceDocument: unknown;
  /** Detached candidate serialized as document JSON. */
  readonly candidateDocument: unknown;
  /** Complete source text for accessible review. */
  readonly sourceText: string;
  /** Complete candidate text for accessible review. */
  readonly candidateText: string;
  /** Whether text is equal while structure or formatting differs. */
  readonly formatOnly: boolean;
  /** Readable description of the source document, when the SDK owner supplies one. */
  readonly sourceView?: string | undefined;
  /** Readable description of the candidate document, in the same notation as `sourceView`. */
  readonly candidateView?: string | undefined;
  /** Block-level changes for people, in document order, when the SDK owner supplies them. */
  readonly changes?: readonly QuireDocumentChange[] | undefined;
}

/** One changed block, paired between the source and candidate documents. */
export interface QuireDocumentChange {
  /** Whether the block changed in place, was added, or was removed. */
  readonly kind: "edited" | "inserted" | "removed";
  /** Title of the story holding the block, such as a header or a comment; omitted in the body. */
  readonly section?: string | undefined;
  /** Start of the block's text, from the source (candidate for an added block), to locate it. */
  readonly excerpt: string;
  /** Text of an edited block as kept, removed and inserted pieces; omitted when its text is unchanged. */
  readonly text?: readonly QuireDocumentTextPiece[] | undefined;
  /** Format changes of an edited block. */
  readonly formats: readonly QuireDocumentFormatChange[];
  /** Objects with an image, such as pictures, that were redrawn, added or removed, shown to people as images. */
  readonly objects?: readonly QuireDocumentObjectChange[] | undefined;
  /** Block content in the source document; for an added block, the point it follows. Omitted for document settings. */
  readonly source?: QuireDocumentRange | undefined;
  /** Block content in the candidate document; for a removed block, the point it was at. Omitted for document settings. */
  readonly candidate?: QuireDocumentRange | undefined;
}

/** Document range, used to show a change in the editor. */
export interface QuireDocumentRange {
  /** Range start. */
  readonly from: number;
  /** Range end; equal to `from` for a point. */
  readonly to: number;
}

/** An object whose image changed, was added or was removed. */
export interface QuireDocumentObjectChange {
  /** Whether the object changed in place, was added, or was removed. */
  readonly kind: "edited" | "inserted" | "removed";
  /** People-facing name, after the change unless the object was removed. */
  readonly label: string;
  /** Image before the change; omitted for an added object. */
  readonly before?: QuireAiPresentedImage | undefined;
  /** Image after the change; omitted for a removed object. */
  readonly after?: QuireAiPresentedImage | undefined;
}

/** One piece of an edited block's text. */
export interface QuireDocumentTextPiece {
  /** Whether the piece is kept, removed or inserted. */
  readonly kind: "same" | "removed" | "inserted";
  /** Piece text. */
  readonly text: string;
}

/** One format change, named and valued for people. */
export interface QuireDocumentFormatChange {
  /** People-facing format name, such as "对齐". */
  readonly label: string;
  /** Value before, or null when unset. */
  readonly before: string | null;
  /** Value after, or null when unset. */
  readonly after: string | null;
  /** Whether the format is an on/off switch such as bold, so only its presence matters. */
  readonly toggle: boolean;
  /** Text the change covers, for character formats on part of a block. */
  readonly text?: string | undefined;
}

/** Facts projected to external clients and first-party UI. */
export type QuireDocumentEvent =
  | { readonly type: "operation"; readonly operation: QuireDocumentOperation }
  | { readonly type: "progress"; readonly operationId: string; readonly progress: QuireDocumentToolProgress }
  | { readonly type: "receipt"; readonly operationId: string; readonly receipt: QuireAiToolWriteReceipt }
  | { readonly type: "preview"; readonly preview: QuireDocumentPreview }
  | { readonly type: "preview-settled"; readonly previewId: string; readonly decision: QuireAiEditPreviewDecision | "cancelled" };

/** Options for a document-bound SDK with application-owned policy. */
export interface QuireDocumentSdkOptions extends Omit<QuireAiToolHostOptions, "requestPreview" | "onReceipt"> {
  /** Stable application document identity; a new document needs a new SDK. */
  readonly documentId: string;
  /** Creates feature-owned tools once per captured request. */
  readonly tools: (host: QuireAiToolHost) => readonly QuireDocumentTool[];
  /** Optional read policy applied before document data is exposed. */
  readonly authorizeRead?: (toolName: string) => boolean;
  /**
   * Optional readable description of a document, attached to review candidates so people
   * review what changed rather than serialized JSON.
   */
  readonly describeDocument?: ((doc: Node) => string) | undefined;
  /**
   * Lists the block-level changes between two documents for people reviewing an edit.
   * @param source - Document before the edit.
   * @param candidate - Document after the edit.
   * @returns Changes in document order.
   */
  readonly describeChanges?: ((source: Node, candidate: Node) => readonly QuireDocumentChange[]) | undefined;
  /**
   * Rewrites internal block ids in assistant text into words people understand.
   * @param text - Assistant text.
   * @param language - Language of the reply.
   * @returns Text without internal ids.
   */
  readonly presentReply?: ((text: string, language: "zh" | "en") => string) | undefined;
  /** Optional product port that decides every tracked change one request made, for one review per request. */
  readonly requestReview?: QuireDocumentRequestReviewPort | undefined;
  /** Optional external review provider; resolves approved or rejected. Invalid decisions and thrown errors fail the operation without committing. Otherwise use events and decidePreview. */
  readonly requestPreview?: (preview: QuireDocumentPreview, signal: AbortSignal) => Promise<QuireAiEditPreviewDecision>;
}

/** Product port that reviews all tracked changes one request made as a single decision. */
export interface QuireDocumentRequestReviewPort {
  /**
   * @param requestId - Captured request.
   * @param document - Document to take the changes from; the editor's current one when omitted.
   * @returns The document with the request's changes rejected and accepted, or null when it made none.
   */
  snapshot(requestId: string, document?: Node): { readonly source: Node; readonly candidate: Node } | null;
  /**
   * Accepts or rejects every tracked change the request made.
   * @param requestId - Captured request.
   * @param decision - User decision.
   * @returns Whether the decision was applied.
   */
  decide(requestId: string, decision: QuireAiEditPreviewDecision): boolean;
}

/** Public API shared by first-party Agents and independent external integrations. */
export interface QuireDocumentSdk {
  /** Stable document identity. */
  readonly documentId: string;
  /** Discovers mounted tools. @param requestId - Optional captured request. @returns JSON tool descriptors. */
  tools(requestId?: string): readonly QuireDocumentToolDescriptor[];
  /** Captures the target before model work. @returns Serializable request identity. */
  captureRequest(): QuireDocumentRequest;
  /** Releases settled request resources. @param requestId - Captured request identity. */
  releaseRequest(requestId: string): void;
  /** Invokes a deduplicated semantic tool. @param request - JSON invocation. @param options - Local cancellation. @returns JSON domain result. */
  invoke(request: QuireDocumentInvocation, options?: QuireDocumentInvocationOptions): Promise<QuireDocumentToolResult>;
  /** Projects detached input progress; cancellation before invoke belongs to options.signal. @param request - Partial invocation. @param options - Local cancellation. */
  observeInput(request: QuireDocumentInvocation, options?: QuireDocumentInvocationOptions): void;
  /**
   * Checks complete arguments against the tool's schema before invoking it, so an
   * integration can reject them with the same precise explanation `invoke` gives.
   * @param request - Complete invocation.
   * @returns Why the arguments do not fit, or undefined when they do.
   */
  checkInput(request: QuireDocumentInvocation): string | undefined;
  /** Reads immutable facts. @param operationId - Logical operation. @returns Known state, or undefined. */
  getOperation(operationId: string): QuireDocumentOperation | undefined;
  /** Subscribes to document facts. @param listener - Fact observer. @returns Idempotent unsubscribe function. */
  subscribe(listener: (event: QuireDocumentEvent) => void): () => void;
  /** Resolves a review. @param previewId - Pending preview. @param decision - User decision. @returns Whether a pending review was resolved. */
  decidePreview(previewId: string, decision: QuireAiEditPreviewDecision): boolean;
  /**
   * Opens one review of every tracked change a request made, settled through `decidePreview`.
   * @param requestId - Captured request whose work has finished.
   * @returns Whether a review was opened; false when the request changed nothing or no review port is configured.
   */
  reviewRequest(requestId: string): boolean;
  /**
   * Prepares assistant text for people: internal block ids become paragraph numbers or quotes.
   * @param text - Assistant text, a whole reply or a streamed part.
   * @param language - Language of the reply; detected from the text when omitted.
   * @returns Text to show.
   */
  presentReply(text: string, language?: "zh" | "en"): string;
  /** Cancels admitted invoke execution, retaining receipts. @param operationId - Logical operation. @returns Whether cancellation was requested. */
  cancel(operationId: string): boolean;
  /** Cancels pending work and detaches editor subscriptions. */
  destroy(): void;
  /**
   * Describes the document and selection as they were when a request was captured.
   * @param requestId - Captured request identity.
   * @returns Model-facing context, or undefined when the SDK provides none.
   */
  describeRequest?(requestId: string): string | undefined;
}
