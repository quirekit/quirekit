import type { SourceRangeSet } from "@quirekit/msfe-core";
import type { CommentThread } from "../protocol/types";

/** Document-local comment state; resets when the host replaces the document. */
export interface CommentsState {
  /** Thread data by id, in creation or import order. */
  readonly threads: ReadonlyMap<string, CommentThread>;
  /** Current source ranges of placed threads; orphaned threads have none. Values are thread ids. */
  readonly ranges: SourceRangeSet<string>;
  /** Thread the reader is focused on, if any. */
  readonly active: string | null;
}

/** A thread's range in the coordinates of the transaction carrying it. */
export interface CommentPlacement {
  /** Thread identity. */
  readonly id: string;
  /** Inclusive start offset. */
  readonly from: number;
  /** Exclusive end offset. */
  readonly to: number;
}

/** Data-only thread change reasons, reported to the host as they are. */
export type CommentUpdateKind = "reply" | "edit" | "resolve" | "reopen" | "delete-message";

/** One state change; positions refer to the document after the transaction's own changes. */
export type CommentOperation =
  | { readonly type: "load"; readonly threads: readonly CommentThread[]; readonly placements: readonly CommentPlacement[] }
  | { readonly type: "create"; readonly thread: CommentThread; readonly placement?: CommentPlacement | undefined }
  | { readonly type: "update"; readonly kind: CommentUpdateKind; readonly thread: CommentThread }
  | { readonly type: "delete"; readonly id: string }
  | { readonly type: "place"; readonly reason: "reattach" | "restore"; readonly placements: readonly CommentPlacement[] }
  | {
    /** Remote collaboration changes merged into the local state; never written back or reported. */
    readonly type: "sync";
    /** Threads added or changed elsewhere. */
    readonly threads: readonly CommentThread[];
    /** Threads deleted elsewhere. */
    readonly removed: readonly string[];
    /** New ranges for threads whose anchor changed. */
    readonly placements: readonly CommentPlacement[];
    /** Threads whose changed anchor no longer resolves; their ranges are dropped. */
    readonly orphaned: readonly string[];
  }
  | { readonly type: "activate"; readonly id: string | null };
