import { Editor, Node, type QuireEditor } from "@quirekit/core";
import type { Transaction } from "@quirekit/pm";
import { describe, expect, it } from "vitest";
import { createQuireAiBlockIdentity } from "./identity";

const text = Node.create({ name: "text", group: "inline" });
const paragraph = Node.create({ name: "paragraph", group: "block", content: "inline*" });
const cell = Node.create({ name: "cell", content: "paragraph+", addAttributes: () => ({ fill: { default: null } }) });
const row = Node.create({ name: "row", content: "cell+" });
const table = Node.create({ name: "table", group: "block", content: "row+" });
const doc = Node.create({ name: "doc", topNode: true, content: "block+" });

/** @param cells - Cell texts by row. @returns Table JSON. */
const grid = (cells: string[][]) => ({ type: "table", content: cells.map(texts => ({ type: "row", content: texts.map(value =>
  ({ type: "cell", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] })) })) });

/** @returns Editor with a paragraph and a 2×2 table. */
function createEditor(): QuireEditor {
  return new Editor({ extensions: [doc, table, row, cell, paragraph, text], content: { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "前" }] }, grid([["A", "B"], ["C", "D"]])
  ] } });
}

/** @param editor - Editor. @returns Text block entries in document order, with their texts. */
function entries(editor: QuireEditor) {
  const list: { pos: number; type: string; size: number; text: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.isTextblock) list.push({ pos, type: node.type.name, size: node.nodeSize, text: node.textContent });
    return true;
  });
  return list;
}

/** @param editor - Editor. @param change - Rewrites the table node. Replaces the whole table in one step. */
function replaceTable(editor: QuireEditor, change: (node: ReturnType<QuireEditor["state"]["doc"]["child"]>) => unknown): void {
  const pos = editor.state.doc.child(0).nodeSize;
  const next = editor.schema.nodeFromJSON(change(editor.state.doc.child(1)) as never);
  editor.commands.command(({ tr }: { tr: Transaction }) => { tr.replaceWith(pos, pos + editor.state.doc.child(1).nodeSize, next); return true; });
}

describe("block identity across a container replaced as a whole", () => {
  it("keeps the ids of cell paragraphs when the table is rewritten with the same shape", () => {
    const editor = createEditor();
    const identity = createQuireAiBlockIdentity(editor);
    const ids = identity.assign(entries(editor));
    replaceTable(editor, node => {
      const json = node.toJSON() as { content: { content: { attrs?: object }[] }[] };
      json.content[0]!.content[0]!.attrs = { fill: "#DCE6F1" };
      return json;
    });
    const texts = entries(editor);
    expect(ids.slice(1).map(id => texts.find(entry => entry.pos === identity.resolve(id))?.text)).toEqual(["A", "B", "C", "D"]);
    expect(identity.assign(texts)).toEqual(ids);
  });

  it("gives new ids when the replacement adds a row, rather than pointing old ids at other cells", () => {
    const editor = createEditor();
    const identity = createQuireAiBlockIdentity(editor);
    const ids = identity.assign(entries(editor));
    replaceTable(editor, () => grid([["新", "行"], ["A", "B"], ["C", "D"]]));
    expect(ids.slice(1).map(id => identity.resolve(id))).toEqual([null, null, null, null]);
    expect(identity.resolve(ids[0]!)).toBe(0);
  });

  it("does not revive a deleted paragraph when its container only shrank", () => {
    const editor = createEditor();
    const identity = createQuireAiBlockIdentity(editor);
    const ids = identity.assign(entries(editor));
    editor.commands.command(({ tr }: { tr: Transaction }) => { tr.delete(0, editor.state.doc.child(0).nodeSize); return true; });
    expect(identity.resolve(ids[0]!)).toBeNull();
    expect(entries(editor).find(entry => entry.pos === identity.resolve(ids[1]!))?.text).toBe("A");
  });
});
