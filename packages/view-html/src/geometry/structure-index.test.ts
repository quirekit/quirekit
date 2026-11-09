import { createEditor } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import * as engine from "@quirekit/view-engine";
import { describe, expect, it, vi } from "vitest";
import { createHtmlSelectionStructureIndex } from "./structure-index";

describe("HTML deferred selection structure", () => {
  it("compiles the captured immutable document once on first consumption", () => {
    const editor = createEditor({ extensions: [StarterKit], content: "<p>Original</p>" });
    const doc = editor.state.doc;
    const compile = vi.spyOn(engine, "createQuireSelectionStructureIntervalIndex");
    try {
      const index = createHtmlSelectionStructureIndex({ doc, extensionManager: editor.extensionManager });
      const copiedSnapshot = { ...{ selectionStructureIndex: index } };
      expect(compile).not.toHaveBeenCalled();
      editor.commands.insertContent("changed");
      copiedSnapshot.selectionStructureIndex.query({ from: 0, to: doc.content.size });
      expect(index.entryCount).toBe(index.entries.length);
      index.query({ from: 0, to: doc.content.size });
      expect(compile).toHaveBeenCalledTimes(1);
      expect(compile.mock.calls[0]![0].doc).toBe(doc);
      expect(editor.state.doc).not.toBe(doc);
    } finally { compile.mockRestore(); editor.destroy(); }
  });
});
