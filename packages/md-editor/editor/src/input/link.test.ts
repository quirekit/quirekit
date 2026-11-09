// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorSelection } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { EditorView } from "@quirekit/cm-view";
import type { MsfeEditor } from "@quirekit/msfe-core";
import { createMdEditor } from "../editor";

const editors: MsfeEditor[] = [];
beforeEach(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: Object.assign(new EventTarget(), { ready: Promise.resolve() }) });
});
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

/** @param source - Markdown with one ¦ caret. @returns Mounted product editor. */
function fixture(source: string): MsfeEditor {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown: source.replace("¦", "") }); editors.push(editor);
  editor.run(() => ({ selection: EditorSelection.single(source.indexOf("¦")) }));
  return editor;
}

/** @param editor - Mounted editor. @returns Source with the caret marked. */
function marked(editor: MsfeEditor): string {
  const doc = editor.state.doc.toString(), head = editor.state.selection.main.head;
  return doc.slice(0, head) + "¦" + doc.slice(head);
}

/** @param editor - Mounted editor. @param text - Typed text. */
function type(editor: MsfeEditor, text: string): void {
  const view = EditorView.findFromDOM(editor.element)!, { from, to } = view.state.selection.main;
  const insert = () => view.state.update({ changes: { from, to, insert: text }, selection: EditorSelection.cursor(from + text.length), userEvent: "input.type" });
  if (!view.state.facet(EditorView.inputHandler).some(handler => handler(view, from, to, text, insert))) view.dispatch(insert());
  ensureSyntaxTree(view.state, view.state.doc.length, 5000);
}

describe("typing inline markup", () => {
  it("opens a link destination without a closing parenthesis", () => {
    const editor = fixture("[文]¦");
    type(editor, "(");
    expect(marked(editor)).toBe("[文](¦");
  });

  it.each([["前**粗*¦后", "*", "前**粗**¦后"], ["前[文](u¦后", ")", "前[文](u)¦后"]])("leaves the caret after a style finished by typing: %s", (source, text, expected) => {
    const editor = fixture(source);
    ensureSyntaxTree(editor.state, editor.state.doc.length, 5000);
    type(editor, text);
    expect(marked(editor)).toBe(expected);
  });
});
