import { createEditor, Node } from "@quirekit/core";
import { expect, it } from "vitest";
import { UndoRedo } from "./undo-redo";

it("isolates explicit operations while keeping adjacent typing in its normal group", () => {
  const editor = createEditor({ extensions: [UndoRedo,
    Node.create({ name: "doc", topNode: true, content: "block+" }),
    Node.create({ name: "paragraph", group: "block", content: "inline*" }),
    Node.create({ name: "text", group: "inline" })
  ] });
  editor.commands.insertContent("a"); editor.commands.insertContent("b");
  const before = editor.state.doc;
  expect(editor.can().closeHistory()).toBe(true);
  expect(editor.state.doc).toBe(before);
  // A can() probe must not close a live typing group.
  editor.commands.insertContent("c");
  editor.commands.undo(); expect(editor.getText()).toBe("");
  editor.commands.redo(); expect(editor.getText()).toBe("abc");
  editor.chain().closeHistory().insertContent("D").run();
  editor.commands.closeHistory(); editor.commands.insertContent("e");
  editor.commands.undo(); expect(editor.getText()).toBe("abcD");
  editor.commands.undo(); expect(editor.getText()).toBe("abc");
  editor.commands.undo(); expect(editor.getText()).toBe("");
  editor.destroy();
});

it("clears the undo history without changing the document", () => {
  const editor = createEditor({ extensions: [UndoRedo,
    Node.create({ name: "doc", topNode: true, content: "block+" }),
    Node.create({ name: "paragraph", group: "block", content: "inline*" }),
    Node.create({ name: "text", group: "inline" })
  ] });
  editor.commands.insertContent("a");
  editor.commands.closeHistory();
  editor.commands.insertContent("b");
  const before = editor.state.doc;
  expect(editor.commands.clearHistory()).toBe(true);
  expect(editor.state.doc).toBe(before);
  expect(editor.can().undo()).toBe(false);
  editor.commands.insertContent("c");
  editor.commands.undo();
  expect(editor.getText()).toBe("ab");
  expect(editor.can().undo()).toBe(false);
  editor.destroy();
});
