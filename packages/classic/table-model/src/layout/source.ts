import type { Node as PMNode } from "@quirekit/pm";
import type { WordTableExplicitCellRef, WordTableMap, WordTableSemanticCellRef } from "../map/types";
import type { QuireTableWordMapSourceOptions } from "./types";
import type {
  QuireTableBorders,
  QuireTableCellMargins,
  QuireTableLength,
  QuireTableSource,
  QuireTableSourceCell,
  QuireTableSourceColumn,
  QuireTableSourceRow
} from "@quirekit/layout/table";
import { readQuireTableFormattedCellFromPreservation } from "./formatting";
import {
  readQuireTableSourceCellBackgroundColor,
  readQuireTableSourceCellBorders,
  readQuireTableSourceCellMargins,
  readQuireTableSourceCellNoWrap,
  readQuireTableSourceCellShading,
  readQuireTableSourceCellSpacing,
  readQuireTableSourceCellVerticalAlign,
  readQuireTableSourceCellWidth,
  readQuireTableSourceGrid,
  readQuireTableSourceRowBorders,
  readQuireTableSourceRowHeight,
  readQuireTableSourceStyleBorders,
  readQuireTableSourceStyleCellMargins,
  readQuireTableSourceTableAlignment,
  readQuireTableSourceTableBorderStyle,
  readQuireTableSourceTableBorders,
  readQuireTableSourceTableIndent,
  readQuireTableSourceTableLayout,
  readQuireTableSourceTableWidth,
  readQuireTableSourceTableShading,
  resolveQuireTableSourceColor
} from "./source-attrs";
import {
  normalizeWordTableBorders,
  normalizeWordTableCellMargins,
  normalizeWordTableDiagnostic,
  normalizeWordTableGridOffset,
  normalizeWordTableGridRect,
  normalizeWordTableLayoutMode,
  normalizeWordTableLength,
  normalizeWordTableRowHeight,
  normalizeWordTableShading
} from "./normalization";
import { normalizeQuireWordTableFloating } from "./floating";
import { applyWordTableLegacyOrigin } from "./anchor-origin";
import {
  resolveQuireTableStyleSourceInputs,
  type QuireTableStyleSourceInputs
} from "./style-source";

/**
 * Creates a normalized table source from a Word-compatible table map.
 *
 * @param options - Source table node, map, id, and document range.
 * @returns Normalized table source consumed by view-side layout.
 */
export function createQuireTableSourceFromWordMap(
  options: QuireTableWordMapSourceOptions
): QuireTableSource {
  const explicitById = new Map(
    options.tableMap.explicitCells.map((cell) => [cell.id, cell])
  );
  const borderStyle = readQuireTableSourceTableBorderStyle(options.tableNode);
  // A live registry is the table-style authority; the import-time snapshot is
  // only a fallback for documents without one.
  const styleInputs = resolveQuireTableStyleSourceInputs(
    options.tableNode,
    options.tableMap,
    options.tableStyleRegistry
  );
  const styleCellMargins = styleInputs === null
    ? normalizeWordTableCellMargins(readQuireTableSourceStyleCellMargins(options.tableNode))
    : styleInputs.tableCellMargins;
  const directCellMargins = normalizeWordTableCellMargins(
    readQuireTableSourceCellMargins(options.tableNode.attrs.defaultCellMargins)
  );
  const effectiveBorders = mergeQuireTableBorders(
    styleInputs === null
      ? normalizeWordTableBorders(readQuireTableSourceStyleBorders(options.tableNode))
      : styleInputs.tableBorders,
    normalizeWordTableBorders(readQuireTableSourceTableBorders(options.tableNode))
  );

  const source: QuireTableSource = {
    tableId: options.tableId,
    tableRange: options.tableRange,
    rows: options.tableMap.rows.map((row) => createRow(options, row)),
    columns: createColumns(options),
    preferredWidth: normalizeWordTableLength(
      readQuireTableSourceTableWidth(options.tableNode)
    ),
    layoutMode: normalizeWordTableLayoutMode(
      readQuireTableSourceTableLayout(options.tableNode)
    ),
    alignment: readQuireTableSourceTableAlignment(options.tableNode),
    tableIndent: normalizeWordTableLength(
      readQuireTableSourceTableIndent(options.tableNode)
    ),
    defaultCellMargins: mergeQuireTableCellMargins(
      styleCellMargins,
      directCellMargins
    ),
    cellSpacing: normalizeWordTableLength(
      readQuireTableSourceCellSpacing(options.tableNode.attrs.cellSpacing)
    ),
    // Word has already resolved the border cascade. An empty result means no
    // border, rather than permission to use the generic table source's grid.
    borders: effectiveBorders ?? {
      top: null, right: null, bottom: null, left: null, insideH: null, insideV: null
    },
    floating: normalizeQuireWordTableFloating(options.tableNode.attrs.floating),
    semanticCells: options.tableMap.semanticCells.map((cell) =>
      createSourceCell(options, cell, explicitById, styleInputs)
    ),
    diagnostics: options.tableMap.diagnostics.map(normalizeWordTableDiagnostic),
    style: {
      backgroundColor: resolveQuireTableSourceColor(
        readQuireTableSourceTableShading(options.tableNode)?.fill
      ),
      borderColor: borderStyle?.color ?? "#000000",
      borderWidth: borderStyle?.width ?? 1
    },
    // Word and WPS size automatic rows by content alone, with no authoring floor.
    contentSizedRows: true
  };
  return options.legacyFloatingOrigin ? applyWordTableLegacyOrigin(source) : source;
}

/**
 * Merges style-derived and direct table cell margins independently per side.
 *
 * Explicit zero lengths remain concrete values because null alone means that
 * a side did not contribute at the current cascade level.
 *
 * @param inherited - Style-derived table defaults.
 * @param direct - Direct table-property overrides.
 * @returns Effective table cell margins, or null when neither source contributes.
 */
function mergeQuireTableCellMargins(
  inherited: QuireTableCellMargins | null,
  direct: QuireTableCellMargins | null
): QuireTableCellMargins | null {
  if (inherited === null && direct === null) return null;
  return {
    top: direct?.top ?? inherited?.top ?? null,
    right: direct?.right ?? inherited?.right ?? null,
    bottom: direct?.bottom ?? inherited?.bottom ?? null,
    left: direct?.left ?? inherited?.left ?? null
  };
}

/**
 * Merges style-derived and direct table borders independently per named edge.
 *
 * @param inherited - Style-derived border defaults.
 * @param direct - Direct table-property overrides.
 * @returns Effective table borders, or null when neither source contributes.
 */
function mergeQuireTableBorders(
  inherited: QuireTableBorders | null,
  direct: QuireTableBorders | null
): QuireTableBorders | null {
  if (inherited === null && direct === null) return null;
  return {
    top: direct?.top ?? inherited?.top ?? null,
    right: direct?.right ?? inherited?.right ?? null,
    bottom: direct?.bottom ?? inherited?.bottom ?? null,
    left: direct?.left ?? inherited?.left ?? null,
    insideH: direct?.insideH ?? inherited?.insideH ?? null,
    insideV: direct?.insideV ?? inherited?.insideV ?? null,
    ...(direct?.tl2br === undefined && inherited?.tl2br === undefined
      ? {}
      : { tl2br: direct?.tl2br ?? inherited?.tl2br ?? null }),
    ...(direct?.tr2bl === undefined && inherited?.tr2bl === undefined
      ? {}
      : { tr2bl: direct?.tr2bl ?? inherited?.tr2bl ?? null })
  };
}

/**
 * Creates normalized source row data from a Word table row ref.
 *
 * @param options - Source table node, map, id, and document range.
 * @param row - Word table row ref.
 * @returns Normalized row source.
 */
function createRow(
  options: QuireTableWordMapSourceOptions,
  row: WordTableMap["rows"][number]
): QuireTableSourceRow {
  const rowNode = options.tableNode.maybeChild(row.rowIndex);

  return {
    id: row.id,
    rowIndex: row.rowIndex,
    rowPos: row.rowPos,
    gridBefore: normalizeWordTableGridOffset(row.gridBefore),
    gridAfter: normalizeWordTableGridOffset(row.gridAfter),
    isHeader: row.isHeader,
    height: normalizeWordTableRowHeight(
      readQuireTableSourceRowHeight(rowNode?.attrs.height)
    ),
    cantSplit: row.cantSplit,
    cellSpacing: normalizeWordTableLength(
      readQuireTableSourceCellSpacing(rowNode?.attrs.cellSpacing)
    ),
    borders: normalizeWordTableBorders(readQuireTableSourceRowBorders(rowNode))
  };
}

/**
 * Creates normalized source columns from declared grid metadata and cell widths.
 *
 * @param options - Source table node and map.
 * @returns Normalized columns matching the map width.
 */
function createColumns(
  options: QuireTableWordMapSourceOptions
): readonly QuireTableSourceColumn[] {
  const grid = readQuireTableSourceGrid(options.tableNode);
  const cellWidths = deriveColumnWidthsFromSingleColumnCells(options);

  return Array.from({ length: options.tableMap.width }, (_, columnIndex) => ({
    id: `${options.tableId}:col-${columnIndex}`,
    columnIndex,
    width: normalizeWordTableLength(grid[columnIndex]?.width ?? null) ??
      cellWidths.get(columnIndex) ??
      null
  }));
}

/**
 * Derives fallback column widths from direct single-column cell widths.
 *
 * Word's full table width algorithm can distribute spanning cells and resolve
 * style/default cascades. This C1 source step stays conservative: a declared
 * table grid column wins, and only the first explicit single-column cell seeds
 * a missing grid width for that physical column.
 *
 * @param options - Source table node and map.
 * @returns Fallback widths keyed by physical column index.
 */
function deriveColumnWidthsFromSingleColumnCells(
  options: QuireTableWordMapSourceOptions
): ReadonlyMap<number, QuireTableLength> {
  const widths = new Map<number, QuireTableLength>();

  for (const explicitCell of options.tableMap.explicitCells) {
    if (explicitCell.range.columnSpan !== 1) {
      continue;
    }

    const columnIndex = explicitCell.range.startColumn;
    if (widths.has(columnIndex)) {
      continue;
    }

    const width = readQuireTableSourceCellWidth(
      readExplicitCellNode(options.tableNode, explicitCell)
    );
    if (width) {
      const normalizedWidth = normalizeWordTableLength(width);
      if (normalizedWidth !== null) {
        widths.set(columnIndex, normalizedWidth);
      }
    }
  }

  return widths;
}

/**
 * Creates one normalized source cell from a semantic Word table cell ref.
 *
 * @param options - Source table node, map, id, and document range.
 * @param cell - Semantic Word table cell ref.
 * @param explicitById - Explicit cells keyed by source id.
 * @param styleInputs - Table-style inputs, when a live registry exists.
 * @returns Normalized source cell.
 */
function createSourceCell(
  options: QuireTableWordMapSourceOptions,
  cell: WordTableSemanticCellRef,
  explicitById: ReadonlyMap<string, WordTableExplicitCellRef>,
  styleInputs: QuireTableStyleSourceInputs | null
): QuireTableSourceCell {
  const origin = explicitById.get(cell.originExplicitCellId);
  if (!origin) {
    throw new RangeError(`Missing origin explicit cell: ${cell.originExplicitCellId}`);
  }

  const originNode = readExplicitCellNode(options.tableNode, origin);
  const style = styleInputs?.cells.get(cell.id);
  const directShading = normalizeWordTableShading(
    readQuireTableSourceCellShading(originNode)
  );
  const backgroundColor = readQuireTableSourceCellBackgroundColor(originNode);
  const directMargins = normalizeWordTableCellMargins(
    readQuireTableSourceCellMargins(originNode.attrs.cellMargins)
  );

  return {
    id: cell.id,
    originExplicitCellId: cell.originExplicitCellId,
    explicitCellIds: [
      cell.originExplicitCellId,
      ...cell.continuationExplicitCellIds
    ],
    originCellPos: cell.originCellPos,
    gridRect: normalizeWordTableGridRect(cell.rect),
    contentRange: {
      from: options.tableRange.from + origin.cellPos,
      to: options.tableRange.from + origin.cellPos + originNode.nodeSize - 2
    },
    shading: directShading
      ?? (backgroundColor === null ? style?.shading ?? null : null),
    backgroundColor,
    borders: normalizeWordTableBorders(
      readQuireTableSourceCellBorders(originNode)
    ),
    styleBorders: style?.styleBorders ?? null,
    cellMargins: style?.cellMargins === null || style?.cellMargins === undefined
      ? directMargins
      : mergeQuireTableCellMargins(style.cellMargins, directMargins),
    preferredWidth: normalizeWordTableLength(
      readQuireTableSourceCellWidth(originNode)
    ),
    noWrap: readQuireTableSourceCellNoWrap(originNode) ?? style?.noWrap ?? null,
    verticalAlign: readQuireTableSourceCellVerticalAlign(originNode)
      ?? style?.verticalAlign ?? null,
    formatted: readQuireTableFormattedCellFromPreservation(
      originNode.attrs.preservation
    )
  };
}

/**
 * Reads the source explicit cell node addressed by a Word table map ref.
 *
 * @param tableNode - Source Word table node.
 * @param cell - Explicit cell ref to resolve.
 * @returns Source Word table cell node.
 */
function readExplicitCellNode(
  tableNode: PMNode,
  cell: WordTableExplicitCellRef
): PMNode {
  const rowNode = tableNode.maybeChild(cell.rowIndex);
  const cellNode = rowNode?.maybeChild(cell.cellIndex);

  if (!cellNode) {
    throw new RangeError(
      `Missing source cell node at row ${cell.rowIndex}, cell ${cell.cellIndex}`
    );
  }

  return cellNode;
}

