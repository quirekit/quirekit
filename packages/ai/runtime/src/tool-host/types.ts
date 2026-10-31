import type { QuireEditor } from "@quirekit/core";
import type { Transaction } from "@quirekit/pm";

/** JSON-like metadata attached to an opaque semantic Tool target. */
export type QuireAiMetadata = Readonly<Record<string, unknown>>;

/** Opaque semantic identity resolved and validated by one feature Tool. */
export interface QuireAiSemanticRef {
  /** Semantic owner kind such as `selection`, `table`, `section`, or `story`. */
  readonly kind: string;
  /** Stable identity that does not expose editor positions to the model. */
  readonly id: string;
  /** Optional ancestry from the broadest semantic owner to this target. */
  readonly path?: readonly string[] | undefined;
  /** Optional feature-owned facts used only for target revalidation. */
  readonly metadata?: QuireAiMetadata | undefined;
}

/** Materialization mode selected by the product write policy. */
export type QuireAiToolWriteMode = "direct" | "tracked";

/** Stable reason why an editor Tool write was rejected before or at command commit. */
export type QuireAiToolWriteErrorCode =
  | "permission-denied"
  | "editor-read-only"
  | "target-locked"
  | "stale-target"
  | "unsupported-write-mode"
  | "preview-unavailable"
  | "missing-tracked-reviewer"
  | "command-unavailable"
  | "command-rejected";

/** Product authorization result for one exact editor Tool write. */
export type QuireAiToolWriteDecision =
  | {
      /** Successful authorization discriminator. */
      readonly allowed: true;
      /** Direct or tracked command materialization selected by the product. */
      readonly mode: QuireAiToolWriteMode;
      /** Whether a detached candidate must be approved before command commit. */
      readonly preview?: "required" | undefined;
      /**
       * For tracked writes the revision system cannot record: `preview` asks for approval of a direct
       * write instead; `revert` writes it directly and reports how to take it back through `onDirectFallback`.
       */
      readonly untrackedFallback?: "preview" | "revert" | undefined;
    }
  | {
      /** Rejected authorization discriminator. */
      readonly allowed: false;
      /** Stable rejection reason. */
      readonly code: "permission-denied";
      /** Optional safe detail for logs and model-visible Tool errors. */
      readonly message?: string | undefined;
    };

/** Context supplied to the product write authorization policy. */
export interface QuireAiToolWriteAuthorizationRequest {
  /** Caller-owned identity of the active Tool call. */
  readonly toolCallId: string;
  /** Feature-owned semantic capability identity. */
  readonly capabilityId: string;
  /** Opaque semantic target selected by the feature. */
  readonly target: QuireAiSemanticRef;
  /** Highest side effect of the write; `policy` changes how the person oversees the document. */
  readonly risk?: QuireAiToolWriteRisk | undefined;
}

/** Side effect of one write, for a policy that asks before every protection or review change. */
export type QuireAiToolWriteRisk = "write" | "policy";

/** Feature-owned target lock and freshness result. */
export type QuireAiToolTargetWriteDecision =
  | {
      /** Writable target discriminator. */
      readonly writable: true;
    }
  | {
      /** Rejected target discriminator. */
      readonly writable: false;
      /** Whether the target is locked or no longer resolves to the same object. */
      readonly code: "target-locked" | "stale-target";
      /** Optional safe rejection detail. */
      readonly message?: string | undefined;
    };

/** Input for one centrally guarded canonical editor command. */
export interface QuireAiToolWriteRequest {
  /** Caller-owned identity of the active Tool call. */
  readonly toolCallId: string;
  /** Request (conversation turn) the call belongs to; tracked writes record it as their execution. */
  readonly executionId?: string | undefined;
  /** Whether a tracked write the revision system refuses may fall back to approval; false reports it unchanged instead. */
  readonly allowUntrackedFallback?: boolean | undefined;
  /** Feature-owned semantic capability identity. */
  readonly capabilityId: string;
  /** Opaque semantic target resolved by the feature. */
  readonly target: QuireAiSemanticRef;
  /** Highest side effect of the write, passed to the product policy. */
  readonly risk?: QuireAiToolWriteRisk | undefined;
  /** Exact cancellation authority supplied to the document Tool invocation. */
  readonly signal: AbortSignal;
  /** Optional optimistic document revision captured by an earlier read Tool. */
  readonly expectedDocumentRevision?: string | undefined;
  /** Modes implemented by this feature command binding. */
  readonly supportedModes: readonly QuireAiToolWriteMode[];
  /** Optional feature-owned target lock and freshness check. */
  readonly checkTarget?: ((
    editor: QuireEditor
  ) => QuireAiToolTargetWriteDecision) | undefined;
  /** Read-only command availability check immediately before mutation. */
  readonly canApply: (
    editor: QuireEditor,
    mode: QuireAiToolWriteMode
  ) => boolean;
  /** Canonical command or command chain that owns the mutation. */
  readonly apply: (
    editor: QuireEditor,
    context: QuireAiToolWriteContext
  ) => boolean;
}

/** Product-owned identity attached to every tracked AI command transaction. */
export interface QuireAiToolTrackedReviewer {
  /** Stable reviewer id used by revision grouping and persistence. */
  readonly id: string;
  /** Human-readable reviewer name shown by review UI and DOCX export. */
  readonly name: string;
}

/** Provenance available while one native Tool invokes an editor command. */
export interface QuireAiToolWriteContext {
  /** Direct or tracked materialization selected at the commit boundary. */
  readonly mode: QuireAiToolWriteMode;
  /** Caller-owned Tool call id used as transaction provenance. */
  readonly toolCallId: string;
  /** Request the call belongs to, recorded as the execution of tracked changes; null when unknown. */
  readonly executionId: string | null;
  /** Feature-owned capability identity used by diagnostics and receipts. */
  readonly capabilityId: string;
  /** Product-owned reviewer required for tracked writes. */
  readonly reviewer: QuireAiToolTrackedReviewer | null;
  /** Product-owned AI identity in every mode, for authored content such as comments; null when not configured. */
  readonly agent: QuireAiToolTrackedReviewer | null;
}

/** Immutable fact emitted only after canonical document state changed. */
export interface QuireAiToolWriteReceipt {
  /** Caller-owned identity of the Tool call that crossed the command boundary. */
  readonly toolCallId: string;
  /** Feature-owned semantic capability identity. */
  readonly capabilityId: string;
  /** Product-selected materialization mode. */
  readonly mode: QuireAiToolWriteMode;
  /** Opaque semantic target supplied to the command binding. */
  readonly target: QuireAiSemanticRef;
  /** Exact canonical document revision immediately before commit. */
  readonly sourceDocumentRevision: string;
  /** Exact canonical document revision observed after commit. */
  readonly documentRevision: string;
  /** Set when a tracked write was written directly, outside revisions and any review, because revisions cannot record it. */
  readonly untracked?: true | undefined;
}

/** A direct write made in place of a tracked one, with what it takes to take it back. */
export interface QuireAiDirectFallback {
  /** Request the write belongs to, or null when unknown. */
  readonly executionId: string | null;
  /** Transactions the write applied, appended ones included, in order. */
  readonly transactions: readonly Transaction[];
}

/** Detached document candidate presented without mutating canonical editor state. */
export interface QuireAiEditPreview {
  /** Caller-owned identity of the Tool call waiting for a product decision. */
  readonly toolCallId: string;
  /** Feature-owned semantic capability represented by the candidate. */
  readonly capabilityId: string;
  /** Opaque semantic target resolved by the feature before capture. */
  readonly target: QuireAiSemanticRef;
  /** Exact document revision from which the candidate was captured. */
  readonly sourceDocumentRevision: string;
  /** Immutable canonical source document retained only for preview presentation. */
  readonly sourceDocument: QuireEditor["state"]["doc"];
  /** Immutable candidate document produced by the captured canonical command. */
  readonly candidateDocument: QuireEditor["state"]["doc"];
  /** Whether source and candidate plain text match despite structural or mark changes. */
  readonly formatOnly: boolean;
}

/** Explicit product decision for one detached edit Preview. */
export type QuireAiEditPreviewDecision = "approved" | "rejected";

/** Product callback that owns detached Preview UI and pending decision state. */
export type QuireAiEditPreviewRequester = (
  preview: QuireAiEditPreview,
  signal: AbortSignal
) => Promise<QuireAiEditPreviewDecision>;

/** Successful guarded write result returned to a native document Tool. */
export type QuireAiToolWriteResult =
  | {
      /** Canonical document mutation discriminator. */
      readonly applied: true;
      /** Immutable commit fact. */
      readonly receipt: QuireAiToolWriteReceipt;
    }
  | {
      /** Already-satisfied command discriminator. */
      readonly applied: false;
      /** No Receipt exists because canonical document state did not change. */
      readonly receipt: null;
      /** Stable non-error result classification. */
      readonly reason: "unchanged" | "rejected";
    };

/** Options used to bind one Tool Host to one editor instance. */
export interface QuireAiToolHostOptions {
  /** Canonical editor whose commands own every mutation. */
  readonly editor: QuireEditor;
  /** Synchronous product policy rechecked directly before command commit. */
  readonly authorizeWrite: (
    request: QuireAiToolWriteAuthorizationRequest
  ) => QuireAiToolWriteDecision;
  /** Reviewer identity used only when authorization selects tracked mode. */
  readonly trackedReviewer?: QuireAiToolTrackedReviewer | undefined;
  /** Optional product-owned detached Preview UI used by request-approval policy. */
  readonly requestPreview?: QuireAiEditPreviewRequester | undefined;
  /** Observes actual canonical commits independently of Tool completion. */
  readonly onReceipt?: ((receipt: QuireAiToolWriteReceipt) => void) | undefined;
  /** Receives direct writes made under `untrackedFallback: "revert"`, so the request review can take them back. */
  readonly onDirectFallback?: ((fallback: QuireAiDirectFallback) => void) | undefined;
}

/** Editor-scoped service used by feature-owned native document Tools. */
export interface QuireAiToolHost {
  /** Runs one bounded read against current canonical editor state. */
  readonly read: <Result>(
    signal: AbortSignal,
    query: (editor: QuireEditor) => Result
  ) => Result;
  /** Guards and executes one canonical editor command without a second command ABI. */
  readonly executeWrite: (
    request: QuireAiToolWriteRequest
  ) => Promise<QuireAiToolWriteResult>;
  /**
   * Reports what the product policy would choose for a write now, without writing.
   * @param request - Authorization facts of the intended write.
   * @returns Mode and whether approval must come first, or null when the write would be refused.
   */
  readonly peekWrite: (request: QuireAiToolWriteAuthorizationRequest) => {
    /** Direct or tracked materialization. */
    readonly mode: QuireAiToolWriteMode;
    /** Whether a detached candidate must be approved before the write. */
    readonly previewRequired: boolean;
  } | null;
}

/** Error thrown through the document Tool failure channel. */
export class QuireAiToolWriteError extends Error {
  /** Stable machine-readable failure classification. */
  readonly code: QuireAiToolWriteErrorCode;

  /**
   * Creates one native Tool write failure.
   *
   * @param code - Stable failure classification.
   * @param message - Safe human-readable detail.
   */
  constructor(code: QuireAiToolWriteErrorCode, message: string) {
    super(message);
    this.name = "QuireAiToolWriteError";
    this.code = code;
  }
}
