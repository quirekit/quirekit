// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorSelection, type EditorState, type TransactionSpec } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { EditorView } from "@quirekit/cm-view";
import { planBlockInput, type MsfeEditor } from "@quirekit/msfe-core";
import { compositionEffect } from "@quirekit/msfe-core/state";
import { createMdEditor } from "../../editor";
import { deleteBlockEdgeBackward, deleteBlockEdgeForward, deleteEmptyCodeBlock, typeBesideOpaqueBlock, unwrapContainer } from "./blocks";
import { enterNewFence } from "../fences/language";
import { atCellEdge, tableFromHeader } from "../table";
import { trailingParagraph } from "./trailing";
import { closeTypedBlock } from "../fences/closers";
import { backspaceBeforeStyle } from "./style";
import { unwrapQuoteLine } from "../quote";

const editors: MsfeEditor[] = [];
beforeEach(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: Object.assign(new EventTarget(), { ready: Promise.resolve() }) });
});
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

/** @param source - Markdown with one ¦ caret. @returns Mounted product editor with a complete syntax tree. */
function fixture(source: string): MsfeEditor {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown: source.replace("¦", "") }); editors.push(editor);
  expect(ensureSyntaxTree(editor.state, editor.state.doc.length, 5000)).not.toBeNull();
  editor.run(() => ({ selection: EditorSelection.single(source.indexOf("¦")) }));
  return editor;
}

/** @param command - Gesture planner. @param source - Input with caret. @returns Output with caret, or null when the planner declines. */
function run(command: (state: EditorState) => TransactionSpec | null, source: string): string | null {
  const editor = fixture(source), spec = command(editor.state);
  if (!spec) return null;
  editor.run(() => spec);
  const doc = editor.state.doc.toString(), head = editor.state.selection.main.head;
  return doc.slice(0, head) + "¦" + doc.slice(head);
}

const table = "| a | b |\n| --- | --- |\n| 1 | 2 |";

describe("Backspace and Delete at edges of closed blocks", () => {
  it.each([
    ["a\n\n---\n\n¦b", "a\n\n¦b"],
    ["a\n\n---\n\n¦", "a\n\n¦"],
    ["```js\nfoo\n```\n\n¦b", "```js\nfoo¦\n```\n\nb"],
    ["```js\nfoo\n```\n\n¦\n\nb", "```js\nfoo¦\n```\n\nb"],
    [`${table}\n\n¦b`, `${table.replace("| 2 |", "| 2¦ |")}\n\nb`],
    ["::: note\nin\n:::\n\n¦b", "::: note\nin¦\n:::\n\nb"],
  ])("Backspace: %s", (source, expected) => expect(run(deleteBlockEdgeBackward, source)).toBe(expected));

  it.each(["a\n\n¦b", "- a\n\n¦b", "```js\na\n¦b\n```"])("Backspace keeps native deletion: %s", source => {
    expect(run(deleteBlockEdgeBackward, source)).toBeNull();
  });

  it("Delete removes a following thematic break and leaves other closed blocks intact", () => {
    expect(run(deleteBlockEdgeForward, "a¦\n\n---\n\nb")).toBe("a¦\n\nb");
    for (const block of ["```js\nfoo\n```", table, "::: note\nin\n:::"]) expect(run(deleteBlockEdgeForward, `a¦\n\n${block}`)).toBe(`a¦\n\n${block}`);
    expect(run(deleteBlockEdgeForward, "a¦\n\nb")).toBeNull();
  });

  it("removes an empty code block and unwraps a container from its body start", () => {
    expect(run(deleteEmptyCodeBlock, "a\n\n```js\n¦\n```")).toBe("a\n\n¦");
    expect(run(deleteEmptyCodeBlock, "```js\n¦x\n```")).toBeNull();
    expect(run(unwrapContainer, "::: note\n¦in\nmore\n:::")).toBe("¦in\nmore");
    expect(run(unwrapContainer, "::: note\nin\n¦more\n:::")).toBeNull();
  });
});

describe("quote lines and headings", () => {
  it("moves a later quote line out as its own paragraph", () => {
    expect(run(unwrapQuoteLine, "> a\n> ¦b")).toBe("> a\n\n¦b");
    expect(run(unwrapQuoteLine, "> ¦a")).toBeNull();
    expect(run(unwrapQuoteLine, "- > a\n  > ¦b")).toBeNull();
  });

  it("opens a paragraph above a heading when Enter is pressed before its text", () => {
    expect(run(state => planBlockInput(state, "enter"), "# ¦Title")).toBe("\n\n# ¦Title");
    expect(run(state => planBlockInput(state, "enter"), "# Ti¦tle")).toBe("# Ti\n\n¦tle");
  });
});

describe("composition after a style that closes its line", () => {
  it("moves text composed inside the style after its closer, where the caret was", () => {
    const editor = fixture("a **b**¦"), view = EditorView.findFromDOM(editor.element)!;
    const contentTo = editor.state.doc.toString().indexOf("**", 4);
    view.dispatch({ effects: compositionEffect.of(true) });
    // Firefox reports the composed text inside the style's text node.
    view.dispatch({ changes: { from: contentTo, insert: "你" }, selection: { anchor: editor.state.doc.length + 1 }, userEvent: "input.type.compose" });
    view.dispatch({ effects: compositionEffect.of(false) });
    expect(editor.state.doc.toString()).toBe("a **b**你");
    expect(editor.state.selection.main.head).toBe(editor.state.doc.length);
  });
});

describe("typing beside a divider", () => {
  it.each([["a\n\n---¦\n\nb", "a\n\n---\n\nx¦\n\nb"], ["a\n\n¦---\n\nb", "a\n\nx¦\n\n---\n\nb"], ["a\n\n---¦", "a\n\n---\n\nx¦"]])("opens a paragraph beside it: %s", (source, expected) => {
    const editor = fixture(source);
    const spec = typeBesideOpaqueBlock(EditorView.findFromDOM(editor.element)!, "x");
    expect(spec).not.toBeNull();
    editor.run(() => spec!);
    const doc = editor.state.doc.toString(), head = editor.state.selection.main.head;
    expect(doc.slice(0, head) + "¦" + doc.slice(head)).toBe(expected);
  });

  it("leaves typing inside text alone", () => expect(typeBesideOpaqueBlock(EditorView.findFromDOM(fixture("a¦b").element)!, "x")).toBeNull());
});

describe("Enter in a new fenced block", () => {
  it.each([["```\njs¦\n```", "```js\n¦\n```"], ["```\n¦\n```", "```\n¦\n```"], ["- a\n\n  ```\n  py¦\n  ```", "- a\n\n  ```py\n  ¦\n  ```"]])("takes a language name or keeps the empty line: %s", (source, expected) => {
    expect(run(enterNewFence, source)).toBe(expected);
  });

  it.each(["```\nhello¦\n```", "```py\nx¦\n```", "```\na\njs¦\n```"])("leaves other lines to native Enter: %s", source => expect(run(enterNewFence, source)).toBeNull());
});

describe("deleting a selection across blocks", () => {
  it.each([
    ["正⟦文\n\n# 标⟧题", "正¦题"], ["- 甲⟦甲\n- 乙⟧乙", "- 甲¦乙"], ["段⟦落\n\n- 甲⟧乙", "段¦乙"],
    ["- [ ] 甲⟦甲\n- [ ] 乙⟧乙", "- [ ] 甲¦乙"], ["甲⟦甲\n\n```js\nco⟧de\n```", "甲¦\n\n```js\nde\n```"],
  ])("joins what remains into the first block: %s", (source, expected) => {
    const from = source.indexOf("⟦"), to = source.indexOf("⟧") - 1, text = source.replace("⟦", "").replace("⟧", "");
    const editor = fixture(text + "¦"), view = EditorView.findFromDOM(editor.element)!;
    editor.run(() => ({ selection: EditorSelection.single(from, to) }));
    view.dispatch({ changes: { from, to }, userEvent: "delete.selection" });
    const doc = editor.state.doc.toString(), head = editor.state.selection.main.head;
    expect(doc.slice(0, head) + "¦" + doc.slice(head)).toBe(expected);
  });
});

describe("table cell input", () => {
  it.each([["| a | b |¦", "| a | b |\n| --- | --- |\n| ¦ |  |"], ["| a |¦", "| a |\n| --- |\n| ¦ |"]])("turns a header row into a table on Enter: %s", (source, expected) => {
    expect(run(tableFromHeader, source)).toBe(expected);
  });

  it.each(["| 只是文字¦", "- | a |¦", "| a | b |\n| - | - |\n| 1 | 2 |¦"])("leaves other lines alone: %s", source => expect(run(tableFromHeader, source)).toBeNull());

  it("consumes Backspace at a cell's start and Delete at its end only", () => {
    const table = "| a | b |\n| - | - |\n";
    expect(atCellEdge(fixture(`${table}| ¦1 | 2 |`).state, false)).toBe(true);
    expect(atCellEdge(fixture(`${table}| 1¦ | 2 |`).state, false)).toBe(false);
    expect(atCellEdge(fixture(`${table}| 1¦ | 2 |`).state, true)).toBe(true);
    expect(atCellEdge(fixture(`${table}| 1 | ¦ |`).state, false)).toBe(true);
    expect(atCellEdge(fixture("a¦b").state, false)).toBe(false);
  });
});

describe("writing after the last block", () => {
  it.each([["a\n\n```js\nb\n```", true], ["a\n\n| x |\n| - |\n| 1 |", true], ["a\n\n---", true], ["a\n\nb", false], ["- a", false], ["```js\nb\n```\n", false]])("%s needs a new paragraph: %s", (source, opens) => {
    const editor = fixture(source + "¦");
    expect(trailingParagraph(EditorView.findFromDOM(editor.element)!)).toEqual(opens ? { at: source.length, insert: "\n\n" } : null);
  });
});

describe("closing a typed container or display math", () => {
  it.each([["a\n\n::: note¦\n\n## b", "a\n\n::: note\n¦\n:::\n\n## b"], ["a\n\n$$¦\n\nb", "a\n\n$$\n\n$$¦\n\nb"]])("adds the closer on Enter: %s", (source, expected) => {
    const editor = fixture(source), spec = closeTypedBlock(editor.state);
    expect(spec).not.toBeNull();
    const next = editor.state.update(spec!).state, doc = next.doc.toString(), head = next.selection.main.head;
    expect(doc.slice(0, head) + "¦" + doc.slice(head)).toBe(expected);
  });

  it.each(["::: note\nx\n:::¦", "$$\nx\n$$¦", "::: note\nbody¦\n:::"])("leaves closed blocks alone: %s", source => expect(closeTypedBlock(fixture(source).state)).toBeNull());
});

describe("Backspace and Delete at the edge of an inline style", () => {
  it.each([
    ["前**¦粗体**后", "delete.backward", -1, "**¦粗体**后"], ["前😀**¦粗**", "delete.backward", -1, "前**¦粗**"],
    ["前`码`¦后", "delete.backward", -1, "前¦后"], ["前**粗体**¦后", "delete.forward", 1, "前**粗体¦**"],
    ["甲\n\n**¦粗**后", "delete.backward", -1, "甲**¦粗**后"], ["# **¦粗**后", "delete.backward", -1, "# ¦粗后"],
  ])("%s %s", (source, event, side, expected) => {
    const editor = fixture(source), view = EditorView.findFromDOM(editor.element)!, head = editor.state.selection.main.head;
    view.dispatch({ changes: side < 0 ? { from: head - 1, to: head } : { from: head, to: head + 1 }, userEvent: event });
    const doc = editor.state.doc.toString(), at = editor.state.selection.main.head;
    expect(doc.slice(0, at) + "¦" + doc.slice(at)).toBe(expected);
  });
});

describe("Backspace before a style that starts a block's text", () => {
  it.each([["- 甲\n- **¦粗**后", "- 甲\n\n**¦粗**后"], ["# **¦粗**后", "**¦粗**后"], ["> **¦粗**后", "**¦粗**后"], ["- [**¦链**](http://a.b)", "[**¦链**](http://a.b)"]])("acts at the block's text start: %s", (source, expected) => {
    const editor = fixture(source);
    expect(backspaceBeforeStyle(EditorView.findFromDOM(editor.element)!)).toBe(true);
    const doc = editor.state.doc.toString(), head = editor.state.selection.main.head;
    expect(doc.slice(0, head) + "¦" + doc.slice(head)).toBe(expected);
  });

  it.each(["前**¦粗**", "甲\n\n**¦粗**后", "**粗¦**"])("leaves other positions to the default handling: %s", source => {
    expect(backspaceBeforeStyle(EditorView.findFromDOM(fixture(source).element)!)).toBe(false);
  });
});
