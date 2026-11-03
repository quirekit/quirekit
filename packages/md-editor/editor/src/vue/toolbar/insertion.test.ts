// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { EditorSelection } from "@quirekit/cm-state";
import { sourceBlockAt, type MsfeEditor, type SourceBlockControls } from "@quirekit/msfe-core";
import { createMdEditor } from "../../editor";
import { insertMarkdownBlock } from "../../commands/insert";
import { toolbarItems } from "./configuration";
import { insertionItems, isBlockInsertionIntent } from "./insertion";
import { dispatchChromeIntent } from "./intent";
import { runToolbarAction } from "./actions";
import { blockInsertionItems } from "../blocks/insertion/catalog";
import { createBlockInsertionWriter } from "../blocks/insertion/writer";

const editors: MsfeEditor[] = [];
const table = "| a | b |\n| --- | --- |\n| one | two |";

/** @param markdown - Canonical test document. @param position - Initial caret. @returns A real editor with public history and source commands. */
function fixture(markdown: string, position = 0): MsfeEditor {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown }); editors.push(editor);
  expect(ensureSyntaxTree(editor.state, editor.state.doc.length, 5000)).not.toBeNull();
  editor.run(() => ({ selection: EditorSelection.cursor(position) }));
  return editor;
}
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

describe("shared structured insertion admission", () => {
  it("disables block templates in a table consistently, while retaining inline and row/column actions", () => {
    const editor = fixture(table, table.indexOf("one") + 1);
    const toolbar = toolbarItems(editor, "zh-CN");
    expect(toolbar.find(item => item.value === "insert-table")?.disabled).toBe(true);
    expect(toolbar.find(item => item.value === "insert-code")?.disabled).toBe(true);
    expect(toolbar.find(item => item.value === "insert-table")?.disabledReason).toContain("表格单元格仅支持行内内容");
    expect(toolbarItems(editor, "en").find(item => item.value === "insert-code")?.disabledReason).toContain("Table cells support inline content only");
    expect(toolbar.find(item => item.value === "table-actions")?.children?.find(item => item.value === "row")?.disabled).toBe(false);
    const menu = insertionItems(editor, "zh-CN").flatMap(group => group.children ?? []);
    expect(menu.filter(item => isBlockInsertionIntent(item.value)).every(item => item.disabled)).toBe(true);
    expect(menu.find(item => item.value === "link")?.disabled).toBe(false);
    expect(menu.find(item => item.value === "inlineMath")?.disabled).toBe(false);
    const mobile = blockInsertionItems(editor, "zh-CN", false, true).flatMap(group => group.children ?? []);
    expect(mobile.some(item => isBlockInsertionIntent(item.value))).toBe(false);
    expect(mobile.some(item => item.value === "link")).toBe(true);
  });
  it("refuses direct commands and deferred workspaces without changing source or history", () => {
    const editor = fixture(table, table.indexOf("one") + 1);
    const intents = { edit: vi.fn(), template: vi.fn(), file: vi.fn() };
    for (const value of ["insert-table", "insert-code", "displayMath", "mermaid", "textDiagram", "flowchart", "mindMap", "whiteboard", "dataView"]) {
      dispatchChromeIntent(editor, value, "zh-CN", editor.captureTarget(), intents);
    }
    runToolbarAction(editor, "insert-table", "zh-CN");
    expect(intents.edit).not.toHaveBeenCalled();
    expect(editor.getMarkdown()).toBe(table);
    expect(editor.history.canUndo).toBe(false);
  });
  it("rejects stale and foreign targets before opening a dialog, including out-of-range foreign selections", () => {
    const editor = fixture("a"), other = fixture("longer paragraph", 12);
    const intents = { edit: vi.fn(), template: vi.fn(), file: vi.fn() };
    dispatchChromeIntent(editor, "displayMath", "zh-CN", other.captureTarget(), intents);
    const stale = editor.captureTarget();
    editor.run(() => ({ changes: { from: 0, insert: "b" } }));
    dispatchChromeIntent(editor, "displayMath", "zh-CN", stale, intents);
    expect(intents.edit).not.toHaveBeenCalled();
    editor.undo(); expect(editor.getMarkdown()).toBe("a");
    expect(editor.history.canUndo).toBe(false);
  });
  it("keeps explicit insertion after a complete table available, with one undo", () => {
    const editor = fixture(table, table.indexOf("one"));
    const block = sourceBlockAt(editor.state, editor.state.selection.main.from)!;
    const controls = { editor, block, target: { ...editor.captureTarget(), selection: EditorSelection.single(block.from, block.to) } } as SourceBlockControls;
    const writer = createBlockInsertionWriter({ controls, side: "after", value: "insert-code" })!;
    expect(writer.commit("```\ncode\n```")).toBe(true);
    expect(editor.getMarkdown()).toBe(`${table}\n\n\`\`\`\ncode\n\`\`\``);
    editor.undo(); expect(editor.getMarkdown()).toBe(table);
    expect(editor.history.canUndo).toBe(false);
    writer.release();
  });
  it("preserves declared container boundaries and refuses colliding delimiters", () => {
    const editor = fixture("::: note Parent\nchild\n:::\n\ntail", 18), before = editor.getMarkdown();
    expect(editor.run(insertMarkdownBlock("::: note Nested\nbody\n:::")).ok).toBe(false);
    expect(editor.getMarkdown()).toBe(before);
    expect(editor.run(insertMarkdownBlock("```\ncode\n```")).ok).toBe(true);
    editor.undo(); expect(editor.getMarkdown()).toBe(before);
  });
  it("retains legal paragraph insertion and blocks read-only documents", () => {
    const editor = fixture("before after", 6), original = editor.getMarkdown();
    runToolbarAction(editor, "insert-table", "zh-CN");
    expect(editor.getMarkdown()).toContain("before\n\n|");
    editor.undo(); expect(editor.getMarkdown()).toBe(original);
    editor.setReadOnly(true);
    expect(editor.run(insertMarkdownBlock(table)).ok).toBe(false);
    const intents = { edit: vi.fn(), template: vi.fn(), file: vi.fn() };
    dispatchChromeIntent(editor, "displayMath", "zh-CN", editor.captureTarget(), intents);
    expect(intents.edit).not.toHaveBeenCalled();
  });
});
