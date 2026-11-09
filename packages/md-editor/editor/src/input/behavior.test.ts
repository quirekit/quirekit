// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorSelection } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { planBlockInput, type BlockInputContext, type BlockInputIntent, type MsfeEditor } from "@quirekit/msfe-core";
import { createMdEditor } from "../editor";
import { ProseContainer } from "../presentation/features";
import type { MdEditorOptions } from "../types";

const editors: MsfeEditor[] = [];
beforeEach(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: Object.assign(new EventTarget(), { ready: Promise.resolve() }) });
});
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

/** @param source - One source caret marker. @param options - Product feature overrides. @returns Real mounted preset with accepted syntax. */
function fixture(source: string, options: Partial<MdEditorOptions> = {}): MsfeEditor {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown: source.replace("¦", ""), ...options }); editors.push(editor);
  expect(ensureSyntaxTree(editor.state, editor.state.doc.length, 5000)).not.toBeNull();
  editor.run(() => ({ selection: EditorSelection.single(source.indexOf("¦")) }));
  return editor;
}

/** @param editor - Mounted product. @param intent - Enter variant. @returns Public atomic command result. */
function input(editor: MsfeEditor, intent: BlockInputIntent = "enter") {
  return editor.run(state => planBlockInput(state, intent));
}

for (const editingMode of ["document", "markdown"] as const) describe(`${editingMode} block input`, () => {
  it.each([
    ["text¦", "text\n\n¦"],
    ["## heading¦", "## heading\n\n¦"],
    ["heading¦\n===", "heading\n===\n\n¦"],
    ["***¦", "***\n\n¦"],
    ["> text¦", "> text\n>\n> ¦"],
    ["> text\n> ¦", "> text\n\n¦"],
    ["> > text\n> > ¦", "> > text\n> \n> ¦"],
    ["- item¦", "- item\n- ¦"],
    ["- [x] task¦", "- [x] task\n- [ ] ¦"],
    ["1. first¦", "1. first\n2. ¦"],
    ["::: note Title\ntext¦\n:::", "::: note Title\ntext\n\n¦\n:::"],
    ["::: note Title\n> quote¦\n:::", "::: note Title\n> quote\n>\n> ¦\n:::"],
    ["---\ntitle: Test\n---¦", "---\ntitle: Test\n---\n\n¦"],
  ])("preserves structural Enter semantics: %s", (source, expected) => {
    const editor = fixture(source, { view: editingMode === "markdown" ? "preview" : "document" });
    expect(input(editor).ok).toBe(true);
    expect(editor.getMarkdown()).toBe(expected.replace("¦", ""));
    expect(editor.state.selection.main.head).toBe(expected.indexOf("¦"));
    editor.undo(); expect(editor.getMarkdown()).toBe(source.replace("¦", ""));
    editor.redo(); expect(editor.getMarkdown()).toBe(expected.replace("¦", ""));
  });

  it("exits code explicitly when the hidden closing fence cannot hold the caret", () => {
    const editor = fixture("```\ncode\n```¦", { view: editingMode === "markdown" ? "preview" : "document" });
    if (editingMode === "document") {
      expect(editor.state.selection.main.head).toBe(8);
      expect(planBlockInput(editor.state, "enter")).toBeNull();
    }
    expect(input(editor, editingMode === "document" ? "exit" : "enter").ok).toBe(true);
    expect(editor.getMarkdown()).toBe("```\ncode\n```\n\n");
    expect(editor.state.selection.main.head).toBe(editor.state.doc.length);
    editor.undo(); expect(editor.getMarkdown()).toBe("```\ncode\n```");
  });

  it.each(["```\ncode¦\n```", "    code¦", "$$\nx¦\n$$", "---\ntitle: Te¦st\n---", "<div>body¦</div>"])(
    "retains native input in literal or unregistered semantic blocks: %s", source => {
      const editor = fixture(source, { view: editingMode === "markdown" ? "preview" : "document" });
      expect(planBlockInput(editor.state, "enter")).toBeNull();
      expect(planBlockInput(editor.state, "lineBreak")).toBeNull();
      expect(editor.getMarkdown()).toBe(source.replace("¦", ""));
    });

  it("uses the same routing for hard breaks and nested code exit", () => {
    const editor = fixture("> - text¦", { view: editingMode === "markdown" ? "preview" : "document" });
    expect(input(editor, "lineBreak").ok).toBe(true);
    expect(editor.getMarkdown()).toBe("> - text  \n>   ");
    const code = fixture("> - ```text\n>   co¦de\n>   ```", { view: editingMode === "markdown" ? "preview" : "document" });
    expect(input(code, "exit").ok).toBe(true);
    expect(code.getMarkdown()).toBe("> - ```text\n>   code\n>   ```\n>   \n>   ");
  });
});

it("breaks the line inside a table cell in document mode and keeps native Enter in Markdown editing", () => {
  for (const editingMode of ["document", "markdown"] as const) {
    const editor = fixture("| a¦ | b |\n| --- | --- |", { view: editingMode === "markdown" ? "preview" : "document" });
    if (editingMode === "markdown") expect(planBlockInput(editor.state, "enter")).toBeNull();
    else {
      expect(input(editor).ok).toBe(true);
      expect(editor.getMarkdown()).toBe("| a<br> | b |\n| --- | --- |");
      editor.undo(); expect(editor.getMarkdown()).toBe("| a | b |\n| --- | --- |");
    }
  }
});

it("allows a custom container owner to handle its paragraph through the public hook", () => {
  const custom = vi.fn(({ state }: BlockInputContext) => ({ changes: { from: state.selection.main.head, insert: " custom" } }));
  const container = ProseContainer.extend({ addBlockInput() {
    return this.parent!().map(rule => ({ ...rule, enter: custom }));
  } });
  const editor = fixture("::: note Title\ntext¦\n:::", { containers: false, extensions: [container] });
  expect(input(editor).ok).toBe(true);
  expect(editor.getMarkdown()).toBe("::: note Title\ntext custom\n:::");
  expect(custom).toHaveBeenCalledTimes(1);
  editor.undo(); expect(editor.getMarkdown()).toBe("::: note Title\ntext\n:::");
});
