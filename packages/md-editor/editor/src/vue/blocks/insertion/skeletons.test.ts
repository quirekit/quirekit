// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { ensureSyntaxTree, syntaxTree } from "@quirekit/cm-language";
import { EditorSelection } from "@quirekit/cm-state";
import type { MsfeEditor } from "@quirekit/msfe-core";
import { createMdEditor } from "../../../editor";
import { mdSlashQuery } from "../../slash/query";
import { blockInsertionItems, blockInsertionSource } from "./catalog";
import { blockInsertionCommand } from "./command";
import { queryFootnotes } from "@quirekit/msfe-markdown-extras";

const editors: MsfeEditor[] = [];
/** Syntax node expected to own the caret after each insertion; an empty paragraph is a blank document line. */
const owners: Record<string, string> = {
  "insert-h1": "ATXHeading1", "insert-h2": "ATXHeading2", "insert-h3": "ATXHeading3", "insert-h4": "ATXHeading4", "insert-h5": "ATXHeading5", "insert-h6": "ATXHeading6",
  "insert-quote": "Blockquote", "insert-table": "TableHeader", "insert-code": "FencedCode", "insert-divider": "HorizontalRule",
  "insert-list": "BulletList", "insert-ordered": "OrderedList", "insert-task": "BulletList", "insert-note": "CustomContainer",
  "insert-warning": "CustomContainer", "insert-details": "CustomContainer", "insert-highlight": "CustomContainer", "insert-nested": "CustomContainer",
  "insert-definition": "DefinitionList",
};
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

/** @returns Every insertion the menus write immediately, without a parameter editor. */
function immediate(): { value: string; source: string }[] {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown: "" }); editors.push(editor);
  return blockInsertionItems(editor, "zh-CN").flatMap(group => group.children ?? [])
    .map(item => ({ value: item.value, source: blockInsertionSource(editor, "zh-CN", item.value) }))
    .filter((item): item is { value: string; source: string } => item.source !== null);
}

it.each(immediate())("inserts an empty skeleton for $value and leaves the caret where typing fills it", ({ value }) => {
  const markdown = "前文\n\n/\n\n后文", parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown }); editors.push(editor);
  ensureSyntaxTree(editor.state, editor.state.doc.length, 5000);
  editor.setSelection(EditorSelection.single(markdown.indexOf("/") + 1));
  const block = mdSlashQuery(editor.state)!.block;
  const source = blockInsertionSource(editor, "zh-CN", value)!;
  expect(editor.run(blockInsertionCommand({ side: "replace", controls: { editor, block, target: editor.captureTarget(), rect: { left: 0, top: 0, width: 0, height: 0 } } } as never, source)).ok).toBe(true);
  const doc = editor.state.doc.toString(), inserted = doc.slice(4, doc.length - 4);
  // Only a required definition term may be written, and it is selected for typing over.
  expect(inserted.replace("术语", "")).not.toMatch(/\p{Script=Han}/u);
  expect(doc).not.toContain("\u0000");
  const tree = ensureSyntaxTree(editor.state, doc.length, 5000) ?? syntaxTree(editor.state);
  const names: string[] = [];
  for (let node: { name: string; parent: unknown } | null = tree.resolveInner(editor.state.selection.main.head, -1); node; node = node.parent as typeof node) names.push(node.name);
  expect(names).toContain(owners[value] ?? "Document");
  if (value === "footnote") {
    const index = queryFootnotes(editor.state);
    expect(index.status === "ready" && [...index.entries.keys()]).toEqual(["NOTE-1"]);
  }
});
