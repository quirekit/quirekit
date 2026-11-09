import { afterEach, describe, expect, it } from "vitest";
import { createEditor, type QuireEditor } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { createWhiteboardDocument, prepareWhiteboardSave, serializeWhiteboard } from "@quirekit/whiteboard";
import { Whiteboard } from "./extension";
import { captureWhiteboardRequest } from "./session";

const editors: QuireEditor[] = [];
const board = createWhiteboardDocument("sample");
const preview = { dataUrl: "data:image/png;base64,AAAA", width: 1, height: 1 };
/** @returns Word-free source editor containing an atom and ordinary text. */
function fixture(): QuireEditor {
  const editor = createEditor({ extensions: [StarterKit, Whiteboard], content: { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "before" }] }, { type: "whiteboard", attrs: { board } }, { type: "paragraph" }
  ] } }); editors.push(editor); return editor;
}
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); });
/**
 * Undo restores an earlier board under a newer revision, since every write of a board advances it.
 * @param json - Document JSON. @param index - Board position among the top-level blocks. @param revision - Expected revision.
 * @returns The JSON with that board's revision replaced.
 */
function revised(json: ReturnType<QuireEditor["getJSON"]>, index: number, revision: number): ReturnType<QuireEditor["getJSON"]> {
  const content = [...json.content!];
  const node = content[index]!;
  content[index] = { ...node, attrs: { ...node.attrs, board: { ...(node.attrs!.board as Record<string, unknown>), revision } } };
  return { ...json, content };
}

it("replaces an explicit trigger only once and rejects a mismatched board", () => {
  const editor = fixture(), before = editor.getJSON();
  const request = captureWhiteboardRequest(editor, undefined, { from: 0, to: 8 })!;
  editor.commands.setTextSelection(10);
  const next = prepareWhiteboardSave(request.document, request.document.scene, preview);
  expect(request.commit({ ...next, id: "other" })).toBe("conflict");
  expect(editor.getJSON()).toEqual(before);
  expect(request.commit(next)).toBe("saved");
  expect(editor.state.doc.firstChild?.attrs.board.id).toBe(next.id);
  expect(request.commit(next)).toBe("missing");
  editor.commands.undo(); expect(editor.getJSON()).toEqual(before); request.release();
});
describe("atomic PM whiteboard sessions", () => {
  it("keeps canceled edits out of source and history", () => {
    const editor = fixture(), original = editor.getJSON(), request = captureWhiteboardRequest(editor, 8)!;
    request.release(); expect(editor.getJSON()).toEqual(original); expect(editor.can().undo()).toBe(false);
    expect(request.commit(prepareWhiteboardSave(board, board.scene, preview))).toBe("missing");
  });
  it("maps unrelated insertions and commits an independently undoable revision", () => {
    const editor = fixture(), request = captureWhiteboardRequest(editor, 8)!;
    editor.commands.insertContentAt(1, "added ");
    const beforeSave = editor.getJSON();
    expect(request.commit(prepareWhiteboardSave(board, board.scene, preview))).toBe("saved");
    request.release();
    expect(editor.commands.undo()).toBe(true); expect(editor.getJSON()).toEqual(revised(beforeSave, 1, 2));
    expect(editor.commands.redo()).toBe(true); expect(editor.state.pm.doc.nodeAt(14)?.attrs.board.revision).toBe(3);
  });
  it("rejects readonly, changed and deleted targets without losing the draft", () => {
    const editor = fixture(), request = captureWhiteboardRequest(editor, 8)!;
    const next = prepareWhiteboardSave(board, board.scene, preview);
    editor.setEditable(false); expect(request.commit(next)).toBe("readonly");
    editor.setEditable(true);
    expect(editor.commands.updateWhiteboard({ position: 8, expected: serializeWhiteboard(board), document: next })).toBe(true);
    expect(request.commit(next)).toBe("conflict");
    editor.commands.deleteRange({ from: 8, to: 9 }); expect(request.commit(next)).toBe("missing"); request.release();
  });
  it("inserts only on save and never mutates in can mode", () => {
    const editor = fixture(), original = editor.getJSON(), fresh = createWhiteboardDocument("new");
    expect(editor.can().insertWhiteboard({ document: fresh })).toBe(true); expect(editor.getJSON()).toEqual(original);
    const request = captureWhiteboardRequest(editor)!; expect(editor.getJSON()).toEqual(original);
    expect(request.commit(prepareWhiteboardSave(request.document, request.document.scene, preview))).toBe("saved"); request.release();
    expect(editor.commands.undo()).toBe(true); expect(editor.getJSON()).toEqual(original);
  });
  it("rejects a target that was deleted and restored by undo", () => {
    const editor = fixture(), request = captureWhiteboardRequest(editor, 8)!;
    editor.commands.deleteRange({ from: 8, to: 9 }); editor.commands.undo();
    expect(request.commit(prepareWhiteboardSave(board, board.scene, preview))).toBe("missing"); request.release();
  });
  it("rejects a complete document replacement, even with equal content", () => {
    const editor = fixture(), request = captureWhiteboardRequest(editor, 8)!;
    editor.commands.setContent(editor.getJSON());
    expect(request.commit(prepareWhiteboardSave(board, board.scene, preview))).toBe("missing"); request.release();
  });
});
