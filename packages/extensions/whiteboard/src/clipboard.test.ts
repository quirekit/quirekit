import { describe, expect, it } from "vitest";
import { createEditor } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { Fragment, Slice } from "@quirekit/pm";
import { createWhiteboardDocument } from "@quirekit/whiteboard";
import { Whiteboard } from "./extension";
import { forkWhiteboardSlice } from "./clipboard";

describe("whiteboard copies", () => {
  it("gives every pasted board a new identity while keeping its scene", () => {
    const editor = createEditor({ extensions: [StarterKit, Whiteboard] });
    try {
      const board = createWhiteboardDocument("original");
      const node = editor.state.pm.schema.nodes.whiteboard!.create({ board });
      const slice = new Slice(Fragment.fromArray([node, node]), 0, 0), pasted = forkWhiteboardSlice(slice);
      expect(pasted.content.child(0).attrs.board.id).not.toBe(board.id);
      expect(pasted.content.child(0).attrs.board.id).not.toBe(pasted.content.child(1).attrs.board.id);
      expect(pasted.content.child(0).attrs.board.scene).toEqual(board.scene);
      expect(slice.content.child(0).attrs.board).toBe(board);
    } finally { editor.destroy(); }
  });
});
