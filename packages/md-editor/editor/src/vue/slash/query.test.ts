// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { EditorSelection } from "@quirekit/cm-state";
import * as core from "@quirekit/msfe-core";
import type { MsfeEditor } from "@quirekit/msfe-core";
import { createMdEditor } from "../../editor";
import { mdSlashQuery } from "./query";
import { blockInsertionItems, blockInsertionSource } from "../blocks/insertion/catalog";
import { searchBlockInsertions } from "../blocks/insertion/search";
import { createBlockInsertionWriter } from "../blocks/insertion/writer";
import type { MdBlockInsertionRequest } from "../blocks/insertion/types";

const editors: MsfeEditor[] = [];
/** @param source - Exact test source. @returns A source owner focused at its slash query. */
function fixture(source: string) {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown: source }); editors.push(editor);
  expect(ensureSyntaxTree(editor.state, editor.state.doc.length, 5000)).not.toBeNull();
  const at = source.indexOf("/"), end = source.indexOf("\n", at);
  editor.setSelection(EditorSelection.single(end < 0 ? source.length : end));
  return editor;
}
afterEach(() => { vi.restoreAllMocks(); editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

it.each(["/", "/表格", "/h2", "/bg", "before\n\n/quote\n\nafter", "::: note Title\n/table\n:::"])("admits only standalone paragraph queries in editable flows: %s", source => {
  const editor = fixture(source), match = mdSlashQuery(editor.state);
  expect(match).not.toBeNull();
  expect(match?.block.name).toBe("Paragraph");
});
it.each(["text /table", "https://example.com", "//", "/foo bar", "/" + "x".repeat(65), "before\n/table", "/table\nafter", "`/code`", "```\n/code\n```", "    /code", "> /quote", "- /list", "$$\n/math\n$$", "::: note\n/table", "[a](/link)"])("keeps ordinary or syntax-owned slash text unchanged: %s", source => {
  expect(mdSlashQuery(fixture(source).state)).toBeNull();
});
it("rejects noncollapsed, multicursor, source and readonly contexts", () => {
  const editor = fixture("/table");
  editor.setSelection(EditorSelection.single(0, 3)); expect(mdSlashQuery(editor.state)).toBeNull();
  editor.setSelection(EditorSelection.create([EditorSelection.cursor(2), EditorSelection.cursor(6)])); expect(mdSlashQuery(editor.state)).toBeNull();
  editor.setSelection(EditorSelection.single(6));
  editor.setMode("source"); expect(mdSlashQuery(editor.state)).toBeNull();
  editor.setMode("live"); editor.setReadOnly(true); expect(mdSlashQuery(editor.state)).toBeNull();
});
it("rejects long lines before syntax lookup and avoids full source materialization", () => {
  const editor = fixture("/" + "x".repeat(100_000)), lookup = vi.spyOn(core, "sourceBlockAt");
  const stringify = vi.spyOn(editor.state.doc, "toString");
  expect(mdSlashQuery(editor.state)).toBeNull();
  expect(lookup).not.toHaveBeenCalled(); expect(stringify).not.toHaveBeenCalled();
});
it("searches the same installed catalog by localized names, aliases and pinyin initials", () => {
  const editor = fixture("/"), catalog = blockInsertionItems(editor, "zh-CN");
  for (const query of ["表格", "table", "BG"]) expect(searchBlockInsertions(catalog, query).map(item => item.key)).toEqual(["insert-table"]);
  expect(searchBlockInsertions(catalog, "h2").map(item => item.key)).toEqual(["insert-h2"]);
  for (const query of ["高亮块", "glk", "callout"]) expect(searchBlockInsertions(catalog, query).map(item => item.key)).toEqual(["insert-highlight"]);
  expect(blockInsertionSource(editor, "zh-CN", "insert-highlight")).toBe("::: highlight {emoji=📌 color=orange}\n\u0000\n:::");
  expect(searchBlockInsertions(catalog, "")).toHaveLength(catalog.flatMap(group => group.children ?? []).length);
  expect(searchBlockInsertions([{ value: "g", label: "g", children: [{ value: "insert-table", label: "Table", disabled: true }] }], "table")).toEqual([]);
});
it("maps deferred replacement, cancels safely and restores the query with one undo", () => {
  const editor = fixture("lead\n\n/image\n\ntail"), block = mdSlashQuery(editor.state)!.block;
  const request: MdBlockInsertionRequest = { side: "replace", value: "image", controls: { editor, block, target: editor.captureTarget(), rect: { left: 0, top: 0, width: 0, height: 0 } } };
  const cancelled = createBlockInsertionWriter(request)!; cancelled.release();
  expect(cancelled.commit("image")).toBe(false);
  const writer = createBlockInsertionWriter(request)!;
  editor.run(() => ({ changes: { from: 0, insert: "new " } }));
  const before = editor.getMarkdown();
  expect(writer.commit("![x](<https://example.com/x.png>)")).toBe(true);
  expect(editor.getMarkdown()).toBe(before.replace("/image", "![x](<https://example.com/x.png>)"));
  editor.undo(); expect(editor.getMarkdown()).toBe(before); writer.release();
});
it.each(["touch", "delete", "readonly", "replace"])("rejects obsolete slash parameter drafts: %s", reason => {
  const editor = fixture("/image"), block = mdSlashQuery(editor.state)!.block;
  const writer = createBlockInsertionWriter({ side: "replace", value: "image", controls: { editor, block, target: editor.captureTarget(), rect: { left: 0, top: 0, width: 0, height: 0 } } })!;
  if (reason === "touch") editor.run(() => ({ changes: { from: 2, insert: "x" } }));
  if (reason === "delete") editor.run(() => ({ changes: { from: 0, to: editor.state.doc.length } }));
  if (reason === "readonly") editor.setReadOnly(true);
  if (reason === "replace") editor.replaceDocument("other", "new");
  const before = editor.getMarkdown(); expect(writer.commit("image")).toBe(false); expect(editor.getMarkdown()).toBe(before); writer.release();
});
it("refuses parameter content that escapes its declared parent flow", () => {
  const source = "::: note Outer\n/image\n:::\n\ntail", editor = fixture(source), block = mdSlashQuery(editor.state)!.block;
  const writer = createBlockInsertionWriter({ side: "replace", value: "image", controls: { editor, block, target: editor.captureTarget(), rect: { left: 0, top: 0, width: 0, height: 0 } } })!;
  expect(writer.commit("::: \n\noutside")).toBe(false);
  expect(editor.getMarkdown()).toBe(source); writer.release();
});
