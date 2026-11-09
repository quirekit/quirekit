import type {} from "@quirekit/collab-contract";
import { Extension } from "@quirekit/core";

/**
 * Collaboration rules of the Block editor's own features. Footnote identity
 * follows local copies only; whiteboards and mind maps are whole objects
 * versioned by the save count their editors already keep.
 */
export const BlockCollaboration = Extension.create({
  name: "blockCollaboration",
  /** @returns Rules for the route C room; inert for editors without collaboration. */
  addCollabRules() {
    return [
      { kind: "version", version: "1" },
      { kind: "server-plugin", key: "blockNoteIdentity", role: "client" },
      { kind: "checked", node: "whiteboard", id: "board/id", data: ["board"], version: "board/revision" },
      { kind: "server-plugin", key: "whiteboardRevision", role: "client" },
      { kind: "checked", node: "mindMap", id: "mind/id", data: ["mind"], version: "mind/document/revision" },
      { kind: "server-plugin", key: "mindMapRevision", role: "client" }
    ];
  }
});
