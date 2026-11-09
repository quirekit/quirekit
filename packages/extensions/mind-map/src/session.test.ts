import { afterEach, describe, expect, it } from "vitest";
import { createEditor, type QuireEditor } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { serializeMindMap, createMindMapEmbed, prepareMindMapSave, serializeMindMapEmbed } from "@quirekit/mind-map";
import { MindMap } from "./extension";
import { captureMindMapRequest } from "./session";

const editors: QuireEditor[] = [];
const mind = createMindMapEmbed("sample");
const preview = { dataUrl: "data:image/png;base64,AAAA", width: 1, height: 1 };
/** @returns Word-free source editor containing an atom and ordinary text. */
function fixture(): QuireEditor {
  const editor = createEditor({ extensions: [StarterKit, MindMap], content: { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "before" }] }, { type: "mindMap", attrs: { mind } }, { type: "paragraph" }
  ] } }); editors.push(editor); return editor;
}
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); });

/**
 * Undo restores an earlier map under a newer revision, since every write of a map advances it.
 * @param json - Document JSON. @param revision - Expected revision of the map, the second top-level block.
 * @returns The JSON with that map's revision replaced.
 */
function revised(json: ReturnType<QuireEditor["getJSON"]>, revision: number): ReturnType<QuireEditor["getJSON"]> {
  const content = [...json.content!];
  const node = content[1]!;
  content[1] = { ...node, attrs: { ...node.attrs, mind: { ...(node.attrs!.mind as Record<string, unknown>), document: { ...(node.attrs!.mind as { document: Record<string, unknown> }).document, revision } } } };
  return { ...json, content };
}
describe("atomic PM mindMap sessions", () => {
  it("refuses invalid public positions without reading outside the document", () => {
    const editor = fixture();
    for (const position of [-1, Infinity, NaN, 0.5, editor.state.doc.content.size + 1]) {
      expect(captureMindMapRequest(editor, position)).toBeNull();
      expect(editor.commands.updateMindMap({ position, expected: serializeMindMapEmbed(mind), document: mind })).toBe(false);
      expect(editor.commands.insertMindMap({ document: mind, from: position })).toBe(false);
    }
  });
  it("keeps canceled edits out of source and history", () => {
    const editor = fixture(), original = editor.getJSON(), request = captureMindMapRequest(editor, 8)!;
    request.release(); expect(editor.getJSON()).toEqual(original); expect(editor.can().undo()).toBe(false);
    expect(request.commit(prepareMindMapSave(mind, { ...preview, source: serializeMindMap(mind.document) }))).toBe("missing");
  });
  it("maps unrelated insertions and commits an independently undoable revision", () => {
    const editor = fixture(), request = captureMindMapRequest(editor, 8)!;
    editor.commands.insertContentAt(1, "added ");
    const beforeSave = editor.getJSON();
    expect(request.commit(prepareMindMapSave(mind, { ...preview, source: serializeMindMap(mind.document) }))).toBe("saved");
    request.release();
    expect(editor.commands.undo()).toBe(true); expect(editor.getJSON()).toEqual(revised(beforeSave, 2));
    expect(editor.commands.redo()).toBe(true); expect(editor.state.pm.doc.nodeAt(14)?.attrs.mind.document.revision).toBe(3);
  });
  it("rejects readonly, changed and deleted targets without losing the draft", () => {
    const editor = fixture(), request = captureMindMapRequest(editor, 8)!;
    const next = prepareMindMapSave(mind, { ...preview, source: serializeMindMap(mind.document) });
    editor.setEditable(false); expect(request.commit(next)).toBe("readonly");
    editor.setEditable(true);
    expect(editor.commands.updateMindMap({ position: 8, expected: serializeMindMapEmbed(mind), document: next })).toBe(true);
    expect(request.commit(next)).toBe("conflict");
    editor.commands.deleteRange({ from: 8, to: 9 }); expect(request.commit(next)).toBe("missing"); request.release();
  });
  it("inserts only on save and never mutates in can mode", () => {
    const editor = fixture(), original = editor.getJSON(), fresh = createMindMapEmbed("new");
    expect(editor.can().insertMindMap({ document: fresh })).toBe(true); expect(editor.getJSON()).toEqual(original);
    const request = captureMindMapRequest(editor)!; expect(editor.getJSON()).toEqual(original);
    expect(request.commit(prepareMindMapSave(request.document, { ...preview, source: serializeMindMap(request.document.document) }))).toBe("saved"); request.release();
    expect(editor.commands.undo()).toBe(true); expect(editor.getJSON()).toEqual(original);
  });
  it("rejects a target that was deleted and restored by undo", () => {
    const editor = fixture(), request = captureMindMapRequest(editor, 8)!;
    editor.commands.deleteRange({ from: 8, to: 9 }); editor.commands.undo();
    expect(request.commit(prepareMindMapSave(mind, { ...preview, source: serializeMindMap(mind.document) }))).toBe("missing"); request.release();
  });
  it("rejects a complete document replacement, even with equal content", () => {
    const editor = fixture(), request = captureMindMapRequest(editor, 8)!;
    editor.commands.setContent(editor.getJSON());
    expect(request.commit(prepareMindMapSave(mind, { ...preview, source: serializeMindMap(mind.document) }))).toBe("missing"); request.release();
  });
  it("refuses a different identity on insertion and accepts only one save per task", () => {
    const editor = fixture(), request = captureMindMapRequest(editor)!;
    const next = prepareMindMapSave(request.document, { ...preview, source: serializeMindMap(request.document.document) });
    expect(request.commit({ ...next, id: "other" })).toBe("conflict");
    expect(request.commit(next)).toBe("saved"); const saved = editor.getJSON();
    expect(request.commit(next)).toBe("missing"); expect(editor.getJSON()).toEqual(saved); request.release();
  });
});
