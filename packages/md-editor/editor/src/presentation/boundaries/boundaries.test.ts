// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { EditorSelection } from "@quirekit/cm-state";
import type { MsfeEditor } from "@quirekit/msfe-core";
import { createMdEditor } from "../../editor";

const editors: MsfeEditor[] = [];
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy(); document.body.replaceChildren(); });

/** @param markdown - Canonical source fixture. @returns Product defaults with public transaction access. */
function editor(markdown: string): MsfeEditor {
  const parent = document.createElement("div"); document.body.append(parent);
  const value = createMdEditor({ parent, markdown }); editors.push(value); return value;
}

it.each(["**word**", "*word*", "~~word~~", "==word==", "++word++", "~word~", "^word^", "`word`", "[word](https://example.com)"])("treats %s as a paired style across movement, deletion and replacement", source => {
  const value = editor(`L ${source} R`), from = value.getMarkdown().indexOf("word"), to = from + 4;
  value.setSelection(EditorSelection.single(from));
  const state = value.state;
  // Backspace at the style's text start deletes the character before the style, which stays intact.
  const deleted = state.update({ changes: { from: 2, to: from }, userEvent: "delete.backward" }).state;
  expect(deleted.doc.toString()).toBe(`L${source} R`);
  const selected = state.update({ selection: EditorSelection.single(from, to) }).state;
  expect(selected.update({ ...selected.replaceSelection(""), userEvent: "delete.selection" }).state.doc.toString()).toBe("L  R");
  expect(selected.update({ ...selected.replaceSelection("new"), userEvent: "input.paste" }).state.doc.toString()).toBe(`L ${source.replace("word", "new")} R`);
});

it.each(["# ", "### ", "> ", "- ", "1. "])("removes the complete %s prefix at Backspace without damaging its text", prefix => {
  const value = editor(`${prefix}word`), from = prefix.length;
  value.setSelection(EditorSelection.single(from));
  const state = value.state;
  expect(state.update({ changes: { from: from - 1, to: from }, userEvent: "delete.backward" }).state.doc.toString()).toBe("word");
});

it("protects table pipes and alignment rows during partial replacement and permits complete deletion", () => {
  const source = "| one | two |\n| --- | --- |\n| red | blue |";
  const value = editor(source), pipe = source.indexOf("|", 1);
  value.setSelection(EditorSelection.single(pipe + 1));
  expect(value.state.update({ changes: { from: pipe, to: pipe + 1 }, userEvent: "delete.backward" }).state.doc.toString()).toBe(source);
  const partial = value.state.update({ selection: EditorSelection.single(source.indexOf("one"), source.indexOf("blue") + 2) }).state;
  const replaced = partial.update({ ...partial.replaceSelection("X"), userEvent: "input.paste" }).state.doc.toString();
  expect(replaced).toContain("| --- | --- |");
  expect(replaced.split("\n")).toHaveLength(3);
  expect(replaced.match(/\|/gu)?.length).toBe(9);
  const all = value.state.update({ selection: EditorSelection.single(0, source.length) }).state;
  expect(all.update({ ...all.replaceSelection(""), userEvent: "delete.selection" }).state.doc.toString()).toBe("");
});

it.each(["| one | two |\n| --- | --- |\n| red | blue |", "| one | two |\n| --- | --- |"])("keeps outer table pipes and the alignment row outside insertion positions: %s", source => {
  const value = editor(source);
  const first = value.state.update({ selection: EditorSelection.single(1) }).state;
  const backward = first.update({ changes: { from: 0, to: 1 }, userEvent: "delete.backward" }).state;
  expect(backward.doc).toBe(first.doc);
  expect(backward.selection.main.head).toBe(1);
  expect(backward.update({ ...backward.replaceSelection("X"), userEvent: "input.type" }).state.doc.toString()).toBe(`|X${source.slice(1)}`);
  const lastRowEnd = source.includes("red") ? source.length - 1 : source.indexOf("\n") - 1;
  value.setSelection(EditorSelection.single(lastRowEnd));
  const forward = value.state.update({ changes: { from: lastRowEnd, to: lastRowEnd + 1 }, userEvent: "delete.forward" }).state;
  expect(forward.doc).toBe(value.state.doc);
  expect(forward.selection.main.head).toBe(lastRowEnd);
  expect(forward.update({ ...forward.replaceSelection("X"), userEvent: "input.type" }).state.doc.toString()).toBe(`${source.slice(0, lastRowEnd)}X${source.slice(lastRowEnd)}`);
  const alignmentEnd = source.includes("red") ? source.indexOf("\n", source.indexOf("\n") + 1) : source.length;
  for (let position = source.indexOf("\n") + 1; position <= alignmentEnd; position++) {
    const selected = value.state.update({ selection: EditorSelection.single(position), userEvent: "select.pointer" }).state;
    expect(selected.selection.main.head).toBe(source.includes("red") ? source.indexOf("| red") + 1 : lastRowEnd);
  }
});

it("moves from table outer edges to neighboring content without changing the table", () => {
  const source = "before\n\n| one | two |\n| --- | --- |\n| red | blue |\n\nafter", value = editor(source);
  const start = source.indexOf("| one"), end = source.lastIndexOf("|");
  for (const [head, from, to, event, expected] of [[start + 1, start, start + 1, "delete.backward", 6],
    [end, end, end + 1, "delete.forward", source.indexOf("after")]] as const) {
    value.setSelection(EditorSelection.single(head));
    const state = value.state.update({ changes: { from, to }, userEvent: event }).state;
    expect(state.doc).toBe(value.state.doc);
    expect(state.selection.main.head).toBe(expected);
  }
});

it.each(["| one | two |\n| --- | --- |\n| red | blue |", "one | two\n--- | ---\nred | blue"])("keeps line endpoints in their table row: %s", source => {
  const value = editor(source), start = source.lastIndexOf("\n") + 1, outer = source.startsWith("|");
  for (const [position, expected, association] of [[start, start + Number(outer), 1],
    [source.length, source.length - Number(outer), -1]] as const) {
    value.setSelection(EditorSelection.single(source.indexOf("blue")));
    const selected = value.state.update({ selection: EditorSelection.single(position), userEvent: "select" }).state;
    expect(selected.selection.main.head).toBe(expected);
    expect(selected.selection.main.assoc).toBe(association);
  }
});

it("preserves a partial code/container shell across native replacements", () => {
  for (const [open, close] of [["```typescript", "```"], ["::: highlight {color=green}", ":::"]]) {
    const source = `before\n\n${open}\nbody\n${close}\n\nafter`, value = editor(source);
    const state = value.state.update({ selection: EditorSelection.single(2, source.indexOf("body") + 2) }).state;
    expect(state.update({ ...state.replaceSelection("X"), userEvent: "input.paste" }).state.doc.toString()).toBe(`beX\n\n${open}\ndy\n${close}\n\nafter`);
  }
});

it("uses host overrides for the same owners without changing other built-in rules", () => {
  const parent = document.createElement("div"); document.body.append(parent);
  const value = createMdEditor({ parent, markdown: "```js\ncode\n```", editingBoundaries: [{ nodes: ["FencedCode"], resolve: () => null }] });
  editors.push(value); value.setSelection(EditorSelection.single(4));
  expect(value.state.selection.main.head).toBe(4);
});

it("retains authored leading blank lines inside a code body as real insertion positions", () => {
  const value = editor("```js\n\nbody\n```"), start = value.getMarkdown().indexOf("\n") + 1;
  value.setSelection(EditorSelection.single(start));
  expect(value.state.selection.main.head).toBe(start);
  expect(value.state.update({ ...value.state.replaceSelection("X"), userEvent: "input.type" }).state.doc.toString()).toBe("```js\nX\nbody\n```");
});

it("selects a thematic break as an object and leaves default frontmatter literal", () => {
  const value = editor("before\n\n***\n\nafter");
  value.setSelection(EditorSelection.single(9));
  expect(value.state.selection.main.head).toBe(11);
  const first = value.state.update({ changes: { from: 8, to: 11 }, userEvent: "delete.backward" }).state;
  expect(first.doc).toBe(value.state.doc);
  expect([first.selection.main.from, first.selection.main.to]).toEqual([8, 11]);
  const yaml = editor("---\ntitle: value\n---\n\nbody");
  yaml.setSelection(EditorSelection.single(9));
  expect(yaml.state.selection.main.head).toBe(9);
});

it("selects the text of a heading or list item when a selection covers only its line", () => {
  for (const [source, from] of [["# 标题", 2], ["- 甲\n- 列表", 6], ["> 引用", 2]] as const) {
    const value = editor(source);
    value.setSelection(EditorSelection.single(source.length, source.lastIndexOf("\n") + 1));
    expect([value.state.selection.main.from, value.state.selection.main.to]).toEqual([from, source.length]);
  }
  const all = editor("# 标题\n\n段落");
  all.setSelection(EditorSelection.single(0, all.state.doc.length));
  expect(all.state.selection.main.from).toBe(0);
});
