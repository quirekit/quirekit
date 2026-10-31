/** Format identifier carried by every exchange document. */
export type CommentsFormat = "quirekit.comments";

/** Exchange versions understood by this package; newer versions are rejected, never guessed. Version 2 allows document comments. */
export type CommentsVersion = 1 | 2;

/** Complete, storage-neutral comment data for one Markdown document. */
export interface CommentsExchange {
  /** Fixed format identifier. */
  readonly format: CommentsFormat;
  /** Exchange version. */
  readonly version: CommentsVersion;
  /** Markdown source the export was taken from. */
  readonly source: CommentsSource;
  /** Threads in no particular order; the editor orders them by resolved anchor. */
  readonly threads: readonly CommentThread[];
}

/** Identity of the Markdown text an exchange document was exported against. */
export interface CommentsSource {
  /** `fnv1a64:` followed by 16 lowercase hex digits over the UTF-8 encoded source. */
  readonly hash: string;
}

/** One discussion attached to a source range or point. */
export interface CommentThread {
  /** Stable identity, unique within the exchange document. */
  readonly id: string;
  /** Where the thread belongs in the Markdown source; omitted for a comment on the whole document (version 2). */
  readonly anchor?: CommentAnchor;
  /** Whether the discussion is closed. */
  readonly resolved: boolean;
  /** Who resolved the thread; present only while resolved. */
  readonly resolvedBy?: CommentPerson;
  /** ISO 8601 UTC resolution time; present only while resolved. */
  readonly resolvedAt?: string;
  /** Root message first; replies reference an earlier message through `parentId`. */
  readonly messages: readonly CommentMessage[];
}

/** Host-provided identity; the editor never derives it from user input. */
export interface CommentPerson {
  /** Stable host user identity. */
  readonly id: string;
  /** Display name at the time of writing. */
  readonly name: string;
  /** Present and true when the author is an AI agent. */
  readonly agent?: true;
}

/** One message in a thread. */
export interface CommentMessage {
  /** Stable identity, unique across the exchange document. */
  readonly id: string;
  /** Null for the root message; otherwise an earlier message in the same thread. */
  readonly parentId: string | null;
  /** Message author. */
  readonly author: CommentPerson;
  /** For a message an AI agent wrote: the person whose request it acted on. */
  readonly requestedBy?: CommentPerson;
  /** ISO 8601 UTC creation time. */
  readonly createdAt: string;
  /** ISO 8601 UTC time of the latest edit. */
  readonly editedAt?: string;
  /** Markdown limited to inline formatting, links and `[@name](url)` mentions. */
  readonly body: string;
  /** Mentions present in `body`, for host notifications. */
  readonly mentions?: readonly CommentMention[];
}

/** A mentioned person, matching the portable mention link written in the body. */
export interface CommentMention {
  /** Stable host user identity. */
  readonly id: string;
  /** Display name without the leading @. */
  readonly label: string;
  /** Destination written in the body link. */
  readonly url: string;
}

/** Layered source anchor: exact hint, collaboration positions and a quote for re-anchoring. */
export interface CommentAnchor {
  /** Quoted text and surrounding context. */
  readonly quote: CommentQuote;
  /** UTF-16 source offsets `[from, to)` at the time the anchor was last resolved. */
  readonly hint: CommentRange;
  /** Hash of the whole source the hint belongs to, same encoding as `CommentsSource.hash`. */
  readonly hash: string;
  /** Collaboration positions, valid only inside the named epoch. */
  readonly relative?: CommentRelativeAnchor;
}

/** W3C-style text quote: the commented text with fixed-size context on both sides. */
export interface CommentQuote {
  /** Commented text; empty for a point comment. */
  readonly exact: string;
  /** Text immediately before `exact`, at most the context length. */
  readonly prefix: string;
  /** Text immediately after `exact`, at most the context length. */
  readonly suffix: string;
}

/** Half-open UTF-16 source interval. */
export interface CommentRange {
  /** Inclusive start offset. */
  readonly from: number;
  /** Exclusive end offset, never before `from`. */
  readonly to: number;
}

/** Serialized collaboration endpoints, opaque to this protocol. */
export interface CommentRelativeAnchor {
  /** Start endpoint as produced by the collaboration binding. */
  readonly start: unknown;
  /** End endpoint as produced by the collaboration binding. */
  readonly end: unknown;
  /** Collaboration epoch in which the endpoints resolve. */
  readonly epoch: string;
}

/** Machine-readable reason a value is not a valid exchange document. */
export type CommentsIssueCode =
  | "invalid-format" | "unsupported-version" | "invalid-value" | "duplicate-id"
  | "invalid-range" | "invalid-date" | "invalid-parent" | "invalid-root" | "invalid-resolution";

/** One validation failure located by a JSON path. */
export interface CommentsIssue {
  /** Failure kind. */
  readonly code: CommentsIssueCode;
  /** JSON path such as `/threads/0/messages/1/parentId`. */
  readonly path: string;
}

/** Validation outcome; invalid input is reported in full rather than partially imported. */
export type CommentsValidation =
  | { readonly ok: true; readonly value: CommentsExchange }
  | { readonly ok: false; readonly issues: readonly CommentsIssue[] };
