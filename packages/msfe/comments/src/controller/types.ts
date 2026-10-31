import type { ComponentViewRenderer } from "@quirekit/msfe-core";
import type { CommentMention, CommentMessage, CommentPerson, CommentRange, CommentsExchange, CommentsIssue, CommentThread } from "../protocol/types";

/** Host configuration; storage, permission rules and notifications stay outside the editor. */
export interface CommentsOptions {
  /** Current user, stamped on new messages and resolutions; null disables writing. */
  readonly user: CommentPerson | null;
  /** Whether the user may create and reply; independent of the source readOnly setting. Defaults to true. */
  readonly canComment?: boolean;
  /** @param thread - Thread under consideration. @returns Whether to offer resolve / reopen; host rules, default unrestricted. */
  readonly canResolve?: (thread: CommentThread) => boolean;
  /**
   * @param thread - Thread holding the message. @param message - Another person's message.
   * @returns Whether the user may delete it, e.g. a moderator; own messages are always deletable. Defaults to false.
   */
  readonly canDelete?: (thread: CommentThread, message: CommentMessage) => boolean;
  /** @param change - One accepted comment operation. */
  readonly onChange?: (change: CommentChange) => void;
  /** @returns A new unique identity; defaults to a random UUID. */
  readonly createId?: () => string;
  /** @returns Current ISO 8601 UTC time; defaults to the system clock. */
  readonly now?: () => string;
  /** Marker for point comments and deleted quotes; products supply their shared icon button. */
  readonly marker?: ComponentViewRenderer<CommentMarkerProps>;
  /** Accessible name of the native marker. Defaults to "Comment". */
  readonly markerLabel?: string;
}

/** Inputs of the inline marker drawn where a thread has no text of its own. */
export interface CommentMarkerProps {
  /** Thread identity. */
  readonly threadId: string;
  /** Whether the thread is focused. */
  readonly active: boolean;
  /** Accessible name. */
  readonly label: string;
  /** Focuses the thread. */
  readonly activate: () => void;
}

/** Host-visible operation kinds; text edits that merely move ranges are not reported. */
export type CommentChangeKind = "create" | "reply" | "edit" | "resolve" | "reopen" | "delete" | "delete-message" | "reattach";

/** One accepted comment operation, with a lazily built snapshot for storage. */
export interface CommentChange {
  /** Operation kind. */
  readonly kind: CommentChangeKind;
  /** Affected thread. */
  readonly threadId: string;
  /** @returns Exchange document for the current source, built only when called. */
  snapshot(): CommentsExchange;
}

/** Message content supplied by the composer. */
export interface CommentInput {
  /** Markdown body, rendered as inline formatting, links and mentions. */
  readonly body: string;
  /** Mentions present in the body. */
  readonly mentions?: readonly CommentMention[];
}

/** Why a comment operation was refused; the state is unchanged. */
export type CommentFailure = "no-user" | "not-permitted" | "not-found" | "invalid-input" | "invalid-range" | "unavailable";

/** Outcome of a comment operation. */
export type CommentResult = { readonly ok: true; readonly id: string } | { readonly ok: false; readonly reason: CommentFailure };

/** Where a thread currently sits relative to the source. */
export type CommentPlacementStatus = "placed" | "detached" | "orphaned" | "document";

/** Thread as the sidebar presents it. */
export interface CommentThreadView {
  /** Stored data. */
  readonly thread: CommentThread;
  /** Current source range; null when orphaned or for a document comment. */
  readonly range: CommentRange | null;
  /** `detached` means the commented text was deleted and the range collapsed to a point; `document` has no range by design. */
  readonly status: CommentPlacementStatus;
  /** Whether resolve / reopen should be offered. */
  readonly resolvable: boolean;
}

/** Outcome of importing exchange data into the current document. */
export type CommentsImport =
  | {
    /** Data was valid and replaced all current threads. */
    readonly ok: true;
    /** Threads placed somewhere other than their stored hint. */
    readonly moved: readonly string[];
    /** Threads that could not be placed. */
    readonly orphaned: readonly string[];
  }
  | {
    /** Data was rejected; current threads are unchanged. */
    readonly ok: false;
    /** Data failed validation. */
    readonly reason: "invalid";
    /** Every validation issue. */
    readonly issues: readonly CommentsIssue[];
  }
  | {
    /** Data was valid but the editor could not accept an update, e.g. during composition. */
    readonly ok: false;
    /** Editor unavailable. */
    readonly reason: "unavailable";
  };
