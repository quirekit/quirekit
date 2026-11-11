import type { QuireJSONContent } from "@quirekit/core";
import { Schema, type Node as PMNode } from "@quirekit/pm";
import { createWordTableMap } from "../map";
import { wordTableNodeSpecs } from "../schema";
import { describe, expect, it } from "vitest";
import { createQuireTableSourceFromWordMap } from "./source";
import type { QuireTableSource } from "@quirekit/layout/table";
import { buildQuireTablePaintModel, layoutQuireTableGeometry } from "@quirekit/layout/table";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { group: "inline" },
    paragraph: { group: "block", content: "inline*" },
    ...wordTableNodeSpecs
  }
});

/**
 * Creates a paragraph JSON node.
 *
 * @param text - Optional paragraph text.
 * @returns Paragraph JSON content.
 */
function paragraph(text = ""): QuireJSONContent {
  return text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };
}

/**
 * Creates a Word table cell JSON node.
 *
 * @param text - Optional cell paragraph text.
 * @param attrs - Optional Word table cell attrs.
 * @returns Word table cell JSON content.
 */
function cell(text = "", attrs: Record<string, unknown> = {}): QuireJSONContent {
  const value = {
    type: "wordTableCell",
    content: [paragraph(text)]
  } satisfies QuireJSONContent;

  return Object.keys(attrs).length === 0 ? value : { ...value, attrs };
}

/**
 * Creates a Word table row JSON node.
 *
 * @param cells - Row cell JSON nodes.
 * @param attrs - Optional Word table row attrs.
 * @returns Word table row JSON content.
 */
function row(
  cells: readonly QuireJSONContent[],
  attrs: Record<string, unknown> = {}
): QuireJSONContent {
  const value = {
    type: "wordTableRow",
    content: [...cells]
  } satisfies QuireJSONContent;

  return Object.keys(attrs).length === 0 ? value : { ...value, attrs };
}

/**
 * Creates a parsed Word table node.
 *
 * @param rows - Table rows.
 * @param attrs - Optional Word table attrs.
 * @returns Parsed `wordTable` node.
 */
function table(
  rows: readonly QuireJSONContent[],
  attrs: Record<string, unknown> = {}
): PMNode {
  const tableJson = Object.keys(attrs).length === 0
    ? { type: "wordTable", content: [...rows] }
    : { type: "wordTable", attrs, content: [...rows] };

  return schema.nodeFromJSON({ type: "doc", content: [tableJson] }).child(0);
}

describe("Quire table Word source adapter", () => {
  it('does not paint a fallback grid when the entire Word border cascade is absent', () => {
    const tableNode = table([row([cell('红头'), cell('发文号')]), row([cell('正文'), cell('日期')])]);
    const source = createSource(tableNode);
    const geometry = layoutQuireTableGeometry({
      tableId: source.tableId, tableRange: source.tableRange, source,
      constraints: { rect: { x: 0, y: 0, width: 600, height: 0 }, defaultRowHeight: 28, defaultCellPadding: 4, defaultBorderWidth: 1 },
      measureContent: () => ({ height: 12 })
    });
    expect(buildQuireTablePaintModel(geometry).borders).toEqual([]);
  });
  it("sizes automatic rows by content for authored and imported tables alike", () => {
    const rows = [row([cell("甲"), cell("乙")])];
    expect(createSource(table(rows)).contentSizedRows).toBe(true);
    expect(createSource(table(rows, { preservation: { source: "lit-docx" } })).contentSizedRows).toBe(true);
  });
  it("normalizes floating table anchors, positioning, clearance, and overlap", () => {
    const tableNode = table([
      row([cell("A1")])
    ], {
      floating: {
        horizontalAnchor: "page",
        verticalAnchor: "text",
        x: 2917,
        y: 264,
        xSpec: "center",
        ySpec: "bottom",
        leftFromText: 180,
        rightFromText: 180,
        topFromText: 90,
        bottomFromText: 90,
        wrap: "around",
        overlap: "never"
      }
    });

    expect(createSource(tableNode).floating).toEqual({
      horizontal: {
        reference: "page",
        offset: 2917 / 15,
        alignment: "center"
      },
      vertical: {
        reference: "text",
        offset: 264 / 15,
        alignment: null
      },
      clearances: {
        top: 6,
        right: 12,
        bottom: 6,
        left: 12
      },
      wrapMode: "around",
      allowOverlap: false
    });
  });

  it("clears imported floating aliases before projecting canonical coordinates", () => {
    const floating = createSource(table([row([cell("A1")])], { floating: {
      horizontalAnchor: null, verticalAnchor: null, x: 0, y: null, xSpec: null, ySpec: null,
      horzAnchor: "page", vertAnchor: "page", tblpX: 1440, tblpY: 720, tblpXSpec: "center", tblpYSpec: "bottom"
    } })).floating;
    expect(floating?.horizontal).toEqual({ reference: "text", offset: 0, alignment: null });
    expect(floating?.vertical).toEqual({ reference: "text", offset: null, alignment: null });
  });

  it("adapts a simple Word table map into a normalized table source", () => {
    const tableNode = table([
      row([cell("A1"), cell("A2")]),
      row([cell("B1"), cell("B2")])
    ], {
      grid: [{ width: { value: 1440, unit: "dxa" } }, { width: null }]
    });
    const tableMap = createWordTableMap(tableNode);

    const source = createQuireTableSourceFromWordMap({
      tableId: "word-table-0",
      tableRange: { from: 0, to: tableNode.nodeSize },
      tableNode,
      tableMap
    });

    expect(source.rows.map((item) => item.id)).toEqual(["row:r0", "row:r1"]);
    expect(source.columns).toEqual([
      {
        id: "word-table-0:col-0",
        columnIndex: 0,
        width: { value: 96, unit: "px" }
      },
      { id: "word-table-0:col-1", columnIndex: 1, width: null }
    ]);
    expect(source.semanticCells.map((item) => item.gridRect)).toEqual([
      { startRow: 0, rowSpan: 1, startColumn: 0, columnSpan: 1 },
      { startRow: 0, rowSpan: 1, startColumn: 1, columnSpan: 1 },
      { startRow: 1, rowSpan: 1, startColumn: 0, columnSpan: 1 },
      { startRow: 1, rowSpan: 1, startColumn: 1, columnSpan: 1 }
    ]);
    expect(source.semanticCells[0]?.contentRange).toEqual({ from: 2, to: 6 });
    expect(source.semanticCells[0]?.preferredWidth).toBeNull();
    expect(source.semanticCells[0]?.backgroundColor).toBeNull();
    expect(source.semanticCells[0]?.formatted).toBeNull();
  });

  it("derives missing grid column widths from single-column cell widths", () => {
    const cellWidth = { value: 1800, unit: "dxa" } as const;
    const tableNode = table([
      row([cell("A1", { width: cellWidth }), cell("A2")]),
      row([cell("B1"), cell("B2")])
    ]);
    const source = createSource(tableNode);

    expect(source.semanticCells[0]?.preferredWidth).toEqual({
      value: 120,
      unit: "px"
    });
    expect(source.semanticCells[1]?.preferredWidth).toBeNull();
    expect(source.columns).toEqual([
      {
        id: "word-table-0:col-0",
        columnIndex: 0,
        width: { value: 120, unit: "px" }
      },
      {
        id: "word-table-0:col-1",
        columnIndex: 1,
        width: null
      }
    ]);
  });

  it("keeps declared grid column widths authoritative over cell widths", () => {
    const gridWidth = { value: 3000, unit: "dxa" } as const;
    const cellWidth = { value: 1800, unit: "dxa" } as const;
    const tableNode = table([
      row([cell("A1", { width: cellWidth }), cell("A2")])
    ], {
      grid: [{ width: gridWidth }, { width: null }]
    });
    const source = createSource(tableNode);

    expect(source.semanticCells[0]?.preferredWidth).toEqual({
      value: 120,
      unit: "px"
    });
    expect(source.columns[0]?.width).toEqual({ value: 200, unit: "px" });
  });

  it("normalizes legacy numeric table columns as grid width fallback", () => {
    const tableNode = table([
      row([cell("A1"), cell("A2")])
    ], {
      legacyColumns: [120, 280]
    });
    const source = createSource(tableNode);

    expect(source.columns).toEqual([
      {
        id: "word-table-0:col-0",
        columnIndex: 0,
        width: { value: 120, unit: "px" }
      },
      {
        id: "word-table-0:col-1",
        columnIndex: 1,
        width: { value: 280, unit: "px" }
      }
    ]);
  });

  it("keeps rich grid widths authoritative over legacy columns", () => {
    const gridWidth = { value: 1800, unit: "dxa" } as const;
    const tableNode = table([
      row([cell("A1"), cell("A2")])
    ], {
      grid: [{ width: gridWidth }, { width: null }],
      legacyColumns: [120, 280]
    });
    const source = createSource(tableNode);

    expect(source.columns[0]?.width).toEqual({ value: 120, unit: "px" });
    expect(source.columns[1]?.width).toBeNull();
  });

  it("preserves Word row height and cell margin metadata", () => {
    const defaultCellMargins = {
      top: { value: 90, unit: "dxa" },
      right: { value: 180, unit: "dxa" },
      bottom: { value: 90, unit: "dxa" },
      left: { value: 180, unit: "dxa" }
    };
    const tableCellSpacing = { value: 120, unit: "dxa" };
    const rowCellSpacing = { value: 90, unit: "dxa" };
    const cellMargins = {
      top: { value: 75, unit: "dxa" },
      right: { value: 300, unit: "dxa" },
      bottom: { value: 150, unit: "dxa" },
      left: { value: 150, unit: "dxa" }
    };
    const height = { value: 600, rule: "atLeast" };
    const tableNode = table([
      row([cell("A1", { cellMargins }), cell("A2")], {
        height,
        cellSpacing: rowCellSpacing
      }),
      row([cell("B1"), cell("B2")])
    ], {
      defaultCellMargins,
      cellSpacing: tableCellSpacing
    });
    const tableMap = createWordTableMap(tableNode);

    const source = createQuireTableSourceFromWordMap({
      tableId: "word-table-0",
      tableRange: { from: 0, to: tableNode.nodeSize },
      tableNode,
      tableMap
    });

    expect(source.defaultCellMargins).toEqual({
      top: { value: 6, unit: "px" },
      right: { value: 12, unit: "px" },
      bottom: { value: 6, unit: "px" },
      left: { value: 12, unit: "px" }
    });
    expect(source.cellSpacing).toEqual({ value: 8, unit: "px" });
    expect(source.rows[0]?.height).toEqual({ value: 40, rule: "at-least" });
    expect(source.rows[0]?.cellSpacing).toEqual({ value: 6, unit: "px" });
    expect(source.rows[1]?.cellSpacing).toBeNull();
    expect(source.semanticCells[0]?.cellMargins).toEqual({
      top: { value: 5, unit: "px" },
      right: { value: 20, unit: "px" },
      bottom: { value: 10, unit: "px" },
      left: { value: 10, unit: "px" }
    });
    expect(source.semanticCells[1]?.cellMargins).toBeNull();
  });

  it("cascades style-derived table defaults before direct table margins", () => {
    const tableNode = table([
      row([cell("A1"), cell("A2")])
    ], {
      styleProperties: {
        inheritanceChain: ["TableNormal", "TableGrid"],
        defaultCellMargins: {
          top: { value: 0, unit: "dxa" },
          right: { value: 108, unit: "dxa" },
          bottom: { value: 0, unit: "dxa" },
          left: { value: 108, unit: "dxa" }
        },
        borders: {
          top: { style: "single", size: 4, color: "000000" },
          insideH: { style: "single", size: 4, color: "000000" }
        }
      },
      defaultCellMargins: {
        bottom: { value: 90, unit: "dxa" }
      },
      borders: {
        top: { style: "double", size: 8, color: "FF0000" }
      }
    });
    const source = createSource(tableNode);

    expect(source.defaultCellMargins).toEqual({
      top: { value: 0, unit: "px" },
      right: { value: 7.2, unit: "px" },
      bottom: { value: 6, unit: "px" },
      left: { value: 7.2, unit: "px" }
    });
    expect(source.borders).toMatchObject({
      top: { style: "double", width: 4 / 3, color: "FF0000" },
      insideH: { style: "single", width: 2 / 3, color: "000000" }
    });
  });

  it("normalizes partial producer cell margins without crashing layout", () => {
    const tableNode = table([
      row([
        cell("A1", {
          cellMargins: {
            top: { value: 75, unit: "dxa" },
            bottom: { value: 150, unit: "dxa" }
          }
        })
      ])
    ], {
      defaultCellMargins: {
        left: { value: 180, unit: "dxa" },
        right: { value: 180, unit: "dxa" }
      }
    });
    const source = createSource(tableNode);

    expect(source.defaultCellMargins).toEqual({
      top: null,
      right: { value: 12, unit: "px" },
      bottom: null,
      left: { value: 12, unit: "px" }
    });
    expect(source.semanticCells[0]?.cellMargins).toEqual({
      top: { value: 5, unit: "px" },
      right: null,
      bottom: { value: 10, unit: "px" },
      left: null
    });
  });

  it("preserves CSS-compatible cell background-color shortcuts", () => {
    const tableNode = table([
      row([
        cell("A1", { backgroundColor: "dbeafe" }),
        cell("A2", { backgroundColor: "#fee2e2" })
      ])
    ]);
    const source = createSource(tableNode);

    expect(source.semanticCells[0]?.backgroundColor).toBe("#dbeafe");
    expect(source.semanticCells[1]?.backgroundColor).toBe("#fee2e2");
  });

  it("preserves Word repeated-header and cant-split row metadata", () => {
    const tableNode = table([
      row([cell("A1"), cell("A2")], { isHeader: true }),
      row([cell("B1"), cell("B2")], { cantSplit: true })
    ]);
    const source = createSource(tableNode);

    expect(source.rows.map((rowSource) => ({
      rowIndex: rowSource.rowIndex,
      isHeader: rowSource.isHeader,
      cantSplit: rowSource.cantSplit
    }))).toEqual([
      { rowIndex: 0, isHeader: true, cantSplit: false },
      { rowIndex: 1, isHeader: false, cantSplit: true }
    ]);
  });

  it("resolves Word grid sizing authority including the auto-fit default", () => {
    expect(createSource(table([], { tableLayout: "autofit" })).layoutMode)
      .toBe("auto-fit");
    expect(createSource(table([], { tableLayout: "fixed" })).layoutMode)
      .toBe("fixed");
    expect(createSource(table([])).layoutMode).toBe("auto-fit");
  });

  it("preserves row-level Word border metadata", () => {
    const borders = {
      top: null,
      right: null,
      bottom: { style: "single", size: 18, color: "0000ff", space: 0 },
      left: null,
      insideH: null,
      insideV: null
    };
    const tableNode = table([
      row([cell("A1"), cell("A2")], { borders }),
      row([cell("B1"), cell("B2")])
    ]);
    const source = createSource(tableNode);

    expect(source.rows[0]?.borders).toEqual({
      top: null,
      right: null,
      bottom: { style: "single", width: 3, color: "0000ff", spacing: 0 },
      left: null,
      insideH: null,
      insideV: null
    });
    expect(source.rows[1]?.borders).toBeNull();
  });

  it("preserves Word row grid offset metadata", () => {
    const tableNode = table([
      row([cell("A1"), cell("A2"), cell("A3")]),
      row([cell("B2")], { gridBefore: 1, gridAfter: 1 })
    ]);
    const source = createSource(tableNode);

    expect(source.rows[1]?.gridBefore).toEqual({
      side: "before",
      startColumn: 0,
      columnSpan: 1
    });
    expect(source.rows[1]?.gridAfter).toEqual({
      side: "after",
      startColumn: 2,
      columnSpan: 1
    });
    expect(source.semanticCells.at(-1)?.gridRect).toEqual({
      startRow: 1,
      rowSpan: 1,
      startColumn: 1,
      columnSpan: 1
    });
  });

  it("preserves the preferred Word table width", () => {
    const tableWidth = { value: 3000, unit: "dxa" };
    const tableNode = table([
      row([cell("A1"), cell("A2")])
    ], {
      width: tableWidth
    });
    const source = createSource(tableNode);

    expect((source as { readonly preferredWidth?: unknown }).preferredWidth)
      .toEqual({ value: 200, unit: "px" });
  });

  it("preserves Word table indent metadata", () => {
    const tableIndent = { value: 720, unit: "dxa" };
    const tableNode = table([
      row([cell("A1"), cell("A2")])
    ], {
      tableIndent
    });
    const source = createSource(tableNode);

    expect(source.tableIndent).toEqual({ value: 48, unit: "px" });
  });

  it("preserves Word table horizontal alignment", () => {
    const tableNode = table([
      row([cell("A1"), cell("A2")])
    ], {
      alignment: "right"
    });
    const source = createSource(tableNode);

    expect(source.alignment).toBe("right");
  });

  it("resolves Word table borders into the C1 table style", () => {
    const borders = {
      top: { style: "single", size: 12, color: "ff0000", space: 0 },
      right: null,
      bottom: null,
      left: null,
      insideH: null,
      insideV: null
    };
    const tableNode = table([
      row([cell("A1"), cell("A2")])
    ], { borders });
    const source = createSource(tableNode);

    expect(source.borders).toEqual({
      top: { style: "single", width: 2, color: "ff0000", spacing: 0 },
      right: null,
      bottom: null,
      left: null,
      insideH: null,
      insideV: null
    });
    expect(source.style).toEqual(expect.objectContaining({
      borderColor: "#ff0000",
      borderWidth: 2
    }));
  });

  it("preserves cell-level Word border metadata", () => {
    const borders = {
      top: null,
      right: { style: "single", size: 18, color: "0000ff", space: 0 },
      bottom: null,
      left: null,
      insideH: null,
      insideV: null
    };
    const tableNode = table([
      row([cell("A1", { borders }), cell("A2")])
    ]);
    const source = createSource(tableNode);

    expect(source.semanticCells[0]?.borders).toEqual({
      top: null,
      right: { style: "single", width: 3, color: "0000ff", spacing: 0 },
      bottom: null,
      left: null,
      insideH: null,
      insideV: null
    });
    expect(source.semanticCells[1]?.borders).toBeNull();
  });

  it("preserves cell-level Word vertical alignment metadata", () => {
    const tableNode = table([
      row([cell("A1", { verticalAlign: "bottom" }), cell("A2")])
    ]);
    const source = createSource(tableNode);

    expect(source.semanticCells[0]?.verticalAlign).toBe("bottom");
    expect(source.semanticCells[1]?.verticalAlign).toBeNull();
  });

  it("preserves cell-level Word no-wrap metadata", () => {
    const tableNode = table([
      row([cell("A1", { noWrap: true }), cell("A2")])
    ]);
    const source = createSource(tableNode);

    expect(source.semanticCells[0]?.noWrap).toBe(true);
    expect(source.semanticCells[1]?.noWrap).toBeNull();
  });

  it("preserves diagonal cell border metadata", () => {
    const borders = {
      top: null,
      right: null,
      bottom: null,
      left: null,
      insideH: null,
      insideV: null,
      tl2br: { style: "single", size: 12, color: "ff0000", space: 0 },
      tr2bl: { style: "dashed", size: 8, color: "00ff00", space: 0 }
    };
    const tableNode = table([
      row([cell("A1", { borders }), cell("A2")])
    ]);
    const source = createSource(tableNode);

    expect(source.semanticCells[0]?.borders).toEqual({
      top: null,
      right: null,
      bottom: null,
      left: null,
      insideH: null,
      insideV: null,
      tl2br: { style: "single", width: 2, color: "ff0000", spacing: 0 },
      tr2bl: {
        style: "dashed",
        width: 8 / 6,
        color: "00ff00",
        spacing: 0
      }
    });
    expect(source.semanticCells[1]?.borders).toBeNull();
  });

  it("preserves merged semantic cells and explicit continuation refs", () => {
    const tableNode = table([
      row([
        cell("A", { vMerge: "restart", rowspan: 2 }),
        cell("B")
      ]),
      row([
        cell("", { vMerge: "continue" }),
        cell("C")
      ])
    ]);
    const source = createSource(tableNode);
    const merged = source.semanticCells[0];

    expect(source.diagnostics).toEqual([]);
    expect(merged?.gridRect).toEqual({
      startRow: 0,
      rowSpan: 2,
      startColumn: 0,
      columnSpan: 1
    });
    expect(merged?.originExplicitCellId).toBe("cell:r0:c0:g0:1");
    expect(merged?.explicitCellIds).toEqual([
      "cell:r0:c0:g0:1",
      "cell:r1:c0:g0:1"
    ]);
    expect(source.semanticCells.map((item) => item.gridRect)).toEqual([
      { startRow: 0, rowSpan: 2, startColumn: 0, columnSpan: 1 },
      { startRow: 0, rowSpan: 1, startColumn: 1, columnSpan: 1 },
      { startRow: 1, rowSpan: 1, startColumn: 1, columnSpan: 1 }
    ]);
  });

  it("adapts legacy horizontal members as one rectangle with only the origin content range", () => {
    const tableNode = table([row([
      cell("起点", { hMerge: "restart" }),
      cell("", { hMerge: "continue" })
    ])], { grid: [{ width: { value: 1440, unit: "dxa" } }, { width: { value: 1440, unit: "dxa" } }] });
    const map = createWordTableMap(tableNode);
    const source = createSource(tableNode);

    expect(source.diagnostics).toEqual([]);
    expect(source.semanticCells).toHaveLength(1);
    expect(source.semanticCells[0]).toMatchObject({
      gridRect: { startRow: 0, rowSpan: 1, startColumn: 0, columnSpan: 2 },
      explicitCellIds: map.explicitCells.map(cell => cell.id),
      contentRange: { from: map.explicitCells[0]!.cellPos,
        to: map.explicitCells[0]!.cellPos + tableNode.child(0).child(0).nodeSize - 2 }
    });
    expect(source.semanticCells[0]!.contentRange.to).toBeLessThan(map.explicitCells[1]!.cellPos);
    const geometry = layoutQuireTableGeometry({
      tableId: source.tableId, tableRange: source.tableRange, source,
      constraints: { rect: { x: 0, y: 0, width: 600, height: 0 }, defaultRowHeight: 28, defaultCellPadding: 4, defaultBorderWidth: 1 },
      measureContent: () => ({ height: 12 })
    });
    expect(geometry.cells).toHaveLength(1);
    expect(geometry.cells[0]!.rect.width).toBe(192);
  });

  it("preserves mixed horizontal and vertical merge semantic geometry", () => {
    const tableNode = table([
      row([
        cell("A", { colspan: 2, gridSpan: 2, vMerge: "restart", rowspan: 2 }),
        cell("B")
      ]),
      row([
        cell("", { colspan: 2, gridSpan: 2, vMerge: "continue" }),
        cell("C")
      ])
    ]);
    const source = createSource(tableNode);
    const merged = source.semanticCells[0];

    expect(source.diagnostics).toEqual([]);
    expect(merged?.gridRect).toEqual({
      startRow: 0,
      rowSpan: 2,
      startColumn: 0,
      columnSpan: 2
    });
    expect(merged?.originExplicitCellId).toBe("cell:r0:c0:g0:2");
    expect(merged?.explicitCellIds).toEqual([
      "cell:r0:c0:g0:2",
      "cell:r1:c0:g0:2"
    ]);
    expect(source.semanticCells.map((item) => item.gridRect)).toEqual([
      { startRow: 0, rowSpan: 2, startColumn: 0, columnSpan: 2 },
      { startRow: 0, rowSpan: 1, startColumn: 2, columnSpan: 1 },
      { startRow: 1, rowSpan: 1, startColumn: 2, columnSpan: 1 }
    ]);
  });

  it("carries malformed table diagnostics through normalized sources", () => {
    const tableNode = table([
      row([cell("", { vMerge: "continue" }), cell("B")])
    ]);
    const source = createSource(tableNode);

    expect(source.diagnostics.map((item) => item.code)).toContain(
      "vmerge-orphan-continue"
    );
    expect(source.semanticCells.map((item) => item.gridRect)).toEqual([
      { startRow: 0, rowSpan: 1, startColumn: 0, columnSpan: 1 },
      { startRow: 0, rowSpan: 1, startColumn: 1, columnSpan: 1 }
    ]);
  });

  it("reads formatter-ready scalar cell metadata from preservation attrs", () => {
    const tableNode = table([
      row([
        cell("￥123.00", {
          preservation: {
            source: "quirekit",
            rawAttributes: {
              formattedCell: {
                rawValue: { kind: "number", value: 123 },
                editText: "123",
                displayText: "￥123.00",
                formatSpec: {
                  kind: "currency",
                  locale: "zh-CN",
                  currency: "CNY",
                  code: "¥#,##0.00"
                }
              }
            }
          }
        })
      ])
    ]);
    const source = createSource(tableNode);

    expect(source.semanticCells[0]?.formatted).toEqual({
      rawValue: { kind: "number", value: 123 },
      editText: "123",
      displayText: "￥123.00",
      formatSpec: {
        kind: "currency",
        locale: "zh-CN",
        currency: "CNY",
        code: "¥#,##0.00"
      }
    });
  });
});

/**
 * Adapts a table fixture through the Word table map source adapter.
 *
 * @param tableNode - Source Word table fixture.
 * @returns Normalized table source for assertions.
 */
function createSource(tableNode: PMNode): QuireTableSource {
  return createQuireTableSourceFromWordMap({
    tableId: "word-table-0",
    tableRange: { from: 0, to: tableNode.nodeSize },
    tableNode,
    tableMap: createWordTableMap(tableNode)
  });
}
