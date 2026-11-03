// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { EditorSelection } from "@quirekit/cm-state";
import { sourceBlankLineAt, type MsfeEditor, type SourceInsertionControls } from "@quirekit/msfe-core";
import { createMdEditor } from "../../../editor";
import { createBlockInsertionWriter } from "./writer";

const editors: MsfeEditor[] = [];
beforeEach(() => {
  // Happy DOM omits FontFaceSet; this suite verifies source ownership.
  Object.defineProperty(document, "fonts", { configurable: true, value: Object.assign(new EventTarget(), { ready: Promise.resolve() }) });
});
/** @param source - Regression source. @param position - Empty physical line. @returns Captured source intent with a mounted editor. */
function fixture(source = "before\n\nafter", position = 7) {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown: source }); editors.push(editor);
  expect(ensureSyntaxTree(editor.state, editor.state.doc.length, 5000)).not.toBeNull();
  const line = sourceBlankLineAt(editor.state, position)!;
  expect(line).not.toBeNull();
  const controls = { editor, line, target: { ...editor.captureTarget(), selection: EditorSelection.single(line.from, line.to) } } as SourceInsertionControls;
  return { editor, controls, request: { controls, side: "at", value: "image" } as const };
}
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

it("maps an empty-line insertion across unrelated edits and replaces exactly that gap with one undo", () => {
  const { editor, request } = fixture(), writer = createBlockInsertionWriter(request)!;
  editor.run(() => ({ changes: { from: 0, insert: "new " } }));
  const before = editor.getMarkdown();
  expect(writer.commit("![image](<https://example.com/a.png>)")).toBe(true);
  expect(editor.getMarkdown()).toBe("new before\n\n![image](<https://example.com/a.png>)\n\nafter");
  expect(writer.commit("again")).toBe(false);
  editor.undo(); expect(editor.getMarkdown()).toBe(before); writer.release();
});

it("releases empty-line drafts and rejects typing, deletion, replacement documents and readonly", () => {
  for (const reason of ["cancel", "type", "delete", "replace", "readonly"]) {
    const { editor, request, controls } = fixture("before\n\n\nafter"), writer = createBlockInsertionWriter(request)!;
    if (reason === "cancel") writer.release();
    if (reason === "type") editor.run(() => ({ changes: { from: controls.line.from, insert: "new" } }));
    if (reason === "delete") editor.run(() => ({ changes: { from: controls.line.from, to: controls.line.from + 1 } }));
    if (reason === "replace") editor.replaceDocument("other", "other");
    if (reason === "readonly") editor.setReadOnly(true);
    const before = editor.getMarkdown();
    expect(writer.commit("payload"), reason).toBe(false); expect(editor.getMarkdown()).toBe(before); writer.release();
  }
});

it.each(["", "before\n", "before\n  "])("owns first and trailing blank lines including whitespace: %j", source => {
  const { editor, request } = fixture(source, source.length), writer = createBlockInsertionWriter(request)!;
  expect(writer.commit("## Added")).toBe(true);
  expect(editor.getMarkdown()).toBe(source ? "before\n\n## Added" : "## Added");
  editor.undo(); expect(editor.getMarkdown()).toBe(source); writer.release();
});

it("admits registered container child flows and refuses payloads that close the parent", () => {
  const source = "::: note Parent\nfirst\n\nlast\n:::\n\ntail";
  const { editor, request } = fixture(source, source.indexOf("\n\n") + 1), writer = createBlockInsertionWriter(request)!;
  expect(writer.commit("::: tip Child\nbody\n:::")).toBe(false);
  expect(editor.getMarkdown()).toBe(source);
  expect(writer.commit("## Added")).toBe(true);
  expect(editor.getMarkdown()).toBe(source.replace("first\n\nlast", "first\n\n## Added\n\nlast"));
  editor.undo(); expect(editor.getMarkdown()).toBe(source); writer.release();
});

it("does not offer a blank line inside an incomplete container or mathematical source", () => {
  for (const source of ["::: note\n\nunfinished", "$$\n\nx^2\n$$", "---\ntitle: Example\n\n---"]) {
    const parent = document.createElement("div"); document.body.append(parent);
    const editor = createMdEditor({ parent, markdown: source }); editors.push(editor);
    expect(ensureSyntaxTree(editor.state, editor.state.doc.length, 5000)).not.toBeNull();
    expect(sourceBlankLineAt(editor.state, source.indexOf("\n\n") + 1)).toBeNull();
  }
  for (const source of ["::: note\n", "$$\n", "---\ntitle: Example\n"]) {
    const parent = document.createElement("div"); document.body.append(parent);
    const editor = createMdEditor({ parent, markdown: source }); editors.push(editor);
    expect(ensureSyntaxTree(editor.state, editor.state.doc.length, 5000)).not.toBeNull();
    expect(sourceBlankLineAt(editor.state, source.length), source).toBeNull();
  }
  for (const source of ["::: note\nbody\n:::\n", "$$\nx\n$$\n", "---\ntitle: Example\n---\n"]) {
    const { request } = fixture(source, source.length);
    const writer = createBlockInsertionWriter(request)!;
    expect(writer.commit("## Added"), source).toBe(true);
    writer.release();
  }
});
