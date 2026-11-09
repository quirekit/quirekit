import { Schema, type Node as PMNode } from "@quirekit/pm";
import { describe, expect, it } from "vitest";
import { createWordTableMap } from "../map";
import { wordTableNodeSpecs } from "../schema";
import { WordTableSelection } from "../selection";
import {
  parseWordTableTsv,
  serializeWordTableSelection
} from "./serialize";
import { createWordTableSelectionHtmlSlice } from "./slice";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { group: "inline" },
    paragraph: { group: "block", content: "inline*" },
    ...wordTableNodeSpecs
  }
});

/**
 * Creates a document with one table.
 *
 * @param rows - Table row JSON objects.
 * @returns Parsed ProseMirror document.
 */
function docWithTable(rows: readonly unknown[]): PMNode {
  return schema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "wordTable",
        content: rows
      }
    ]
  });
}

/**
 * Creates a row JSON object.
 *
 * @param cells - Cell JSON objects.
 * @returns Row JSON.
 */
function row(cells: readonly unknown[]): unknown {
  return { type: "wordTableRow", content: cells };
}

/**
 * Creates a cell JSON object.
 *
 * @param text - Cell paragraph text.
 * @param attrs - Optional cell attrs.
 * @returns Cell JSON.
 */
function cell(text: string, attrs: Record<string, unknown> = {}): unknown {
  return {
    type: "wordTableCell",
    attrs,
    content: [
      {
        type: "paragraph",
        content: text.length > 0
          ? [{ type: "text", text }]
          : []
      }
    ]
  };
}

/**
 * Creates a structural selection over explicit cell indices.
 *
 * @param doc - Source document.
 * @param anchorCellIndex - Anchor explicit cell index.
 * @param headCellIndex - Head explicit cell index.
 * @returns Structural Word table selection.
 */
function selectionBetweenCells(
  doc: PMNode,
  anchorCellIndex: number,
  headCellIndex: number
): WordTableSelection {
  const map = createWordTableMap(doc.child(0));

  return WordTableSelection.create(doc, {
    tablePos: 0,
    anchorCellPos: map.explicitCells[anchorCellIndex]!.cellPos,
    headCellPos: map.explicitCells[headCellIndex]!.cellPos
  });
}

describe("Word table clipboard adapters", () => {
  it("retains horizontal physical members internally and projects one full-width HTML origin", () => {
    const doc = docWithTable([
      row([cell("A", { hMerge: "restart" }), cell("", { hMerge: "continue" })]),
      row([cell("B"), cell("C")])
    ]);
    const selection = selectionBetweenCells(doc, 0, 0);
    expect(selection.rect.columnSpan).toBe(2);
    const original = doc.toJSON();
    const serialized = serializeWordTableSelection(selection);
    const internal = serialized.slice.content.firstChild!;
    expect(internal.child(0).childCount).toBe(2);
    expect(internal.child(0).children.map(node => node.attrs.hMerge)).toEqual(["restart", "continue"]);
    expect(createWordTableMap(internal).semanticCells[0]!.rect.columnSpan).toBe(2);
    const html = createWordTableSelectionHtmlSlice(selection).content.firstChild!;
    expect(html.child(0).childCount).toBe(1);
    expect(html.child(0).child(0).attrs).toMatchObject({ gridSpan: 2, colspan: 2, hMerge: null });
    expect(serialized.tsv).toBe("A\t");
    expect(doc.toJSON()).toEqual(original);
  });
  it("word-table-clipboard-serializes-selection-to-slice-html-and-tsv", () => {
    const doc = docWithTable([
      row([cell("A"), cell("B")]),
      row([cell("C"), cell("D")])
    ]);
    const selection = selectionBetweenCells(doc, 0, 3);
    const serialized = serializeWordTableSelection(selection);
    const table = serialized.slice.content.firstChild;

    expect(table?.type.name).toBe("wordTable");
    expect(table?.childCount).toBe(2);
    expect(table?.child(0).childCount).toBe(2);
    expect(serialized.tsv).toBe("A\tB\nC\tD");
  });

  it("word-table-clipboard-preserves-merged-cell-semantics", () => {
    const doc = docWithTable([
      row([
        cell("A", { vMerge: "restart", rowspan: 2 }),
        cell("B")
      ]),
      row([
        cell("", { vMerge: "continue" }),
        cell("D")
      ])
    ]);
    const selection = selectionBetweenCells(doc, 0, 3);
    const serialized = serializeWordTableSelection(selection);
    const table = serialized.slice.content.firstChild;

    expect(table?.child(0).child(0).attrs.vMerge).toBe("restart");
    expect(table?.child(1).child(0).attrs.vMerge).toBe("continue");
    expect(serialized.tsv).toBe("A\tB\n\tD");
  });

  it("word-table-clipboard-parses-tsv-to-internal-table-slice", () => {
    const slice = parseWordTableTsv({
      schema,
      tsv: "A\tB\nC\tD"
    });
    const table = slice.content.firstChild;

    expect(table?.type.name).toBe("wordTable");
    expect(table?.childCount).toBe(2);
    expect(table?.child(0).childCount).toBe(2);
    expect(table?.child(1).child(1).textContent).toBe("D");
  });
});
