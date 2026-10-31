import type { Doc } from "yjs";
import type { CollaborationSession } from "@quirekit/msfe-collaboration";
import type { CommentRange } from "../protocol/types";
import type { CommentsRoomBinding } from "./binding";

/** Collaboration wiring supplied by the host. */
export interface CommentsCollaborationOptions {
  /** Source collaboration session installed through `Collaboration`; supplies the shared text and epoch. */
  readonly session: CollaborationSession | null;
  /** Connected and initially synchronized comment document, separate from the source document. */
  readonly room: Doc | null;
}

/** Editor-local storage holding the active room binding. */
export interface CommentsCollaborationStorage {
  /** Present between creation and destruction. */
  binding?: CommentsRoomBinding;
}

/** Outcome of resolving stored collaboration endpoints. */
export type RelativeResolution =
  | {
    /** Both endpoints resolved on the source text. */
    readonly status: "placed";
    /** Current source range. */
    readonly range: CommentRange;
  }
  | {
    /** A referenced character has not reached this client yet. */
    readonly status: "pending";
  }
  | {
    /** Malformed, collected or foreign endpoints; the quote decides instead. */
    readonly status: "invalid";
  };
