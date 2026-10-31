import { Extension } from "@quirekit/msfe-core";
import { CommentsRoomBinding } from "./binding";
import type { CommentsCollaborationOptions, CommentsCollaborationStorage } from "./types";

/** Shares comments through a host-connected room beside source collaboration; the room never carries source text. */
export const CommentsCollaboration = Extension.create<CommentsCollaborationOptions, CommentsCollaborationStorage>({
  name: "commentsCollaboration", requires: ["comments", "collaboration"],
  /** @returns Inert defaults, validated when the editor is created. */
  addOptions() { return { session: null, room: null }; },
  /** @returns Per-installation binding slot. */
  addStorage() { return {}; },
  /** @returns Disposer that stops observing the room. */
  onCreate() {
    const { session, room } = this.options;
    if (!session || !room) throw new Error("comments-collaboration-room-required");
    if (room === session.document) throw new Error("comments-collaboration-room-shared-with-source");
    const binding = this.storage.binding = new CommentsRoomBinding(this.editor, session, room);
    return () => { binding.destroy(); delete this.storage.binding; };
  },
  /** @param event - Accepted transaction; local comment operations go to the room. */
  onTransaction(event) { this.storage.binding?.transaction(event.transaction); },
  /** @param event - Source change; undo repair and pending anchors. */
  onUpdate(event) { this.storage.binding?.changed(event); },
});
