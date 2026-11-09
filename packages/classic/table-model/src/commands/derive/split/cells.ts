import type { Node as PMNode } from "@quirekit/pm";
import { createEmptyWordTableCellNode } from "../node/builder";
import { cloneCellWithAttrs } from "../node/clone";
import type { WordTableCommandNodeTypes } from "../shared/types";

/** Options used while creating split replacement cells for one row. */
interface CreateSplitCellsForRowOptions {
  /** Original cell that contributes attrs and possibly content. */
  readonly sourceCell: PMNode;
  /** Whether the first output cell should keep source content. */
  readonly usesSourceContent: boolean;
  /** Number of cells to create for this row. */
  readonly columnCount: number;
  /** Command node types used for empty cells. */
  readonly nodeTypes: WordTableCommandNodeTypes;
}

/**
 * Creates the replacement cells for one split row.
 *
 * @param options - Split cell creation options.
 * @returns Replacement cells.
 */
export function createSplitCellsForRow(
  options: CreateSplitCellsForRowOptions
): readonly PMNode[] {
  return Array.from({ length: options.columnCount }, (_item, index) => {
    if (index === 0 && options.usesSourceContent) {
      return options.sourceCell.type.create({
        ...options.sourceCell.attrs,
        colspan: 1,
        gridSpan: 1,
        rowspan: 1,
        vMerge: null,
        hMerge: null,
      }, options.sourceCell.content, options.sourceCell.marks);
    }

    return createEmptyWordTableCellNode(options.nodeTypes);
  });
}

/**
 * Expands a sibling cell over rows inserted by a split operation.
 *
 * @param cell - Source cell.
 * @param extraRowCount - Number of inserted rows.
 * @returns Expanded cell, or null when the source cell is a vertical continuation.
 */
export function expandCellOverInsertedSplitRows(
  cell: PMNode,
  extraRowCount: number
): PMNode | null {
  if (cell.attrs.vMerge === "continue") {
    return null;
  }

  return cloneCellWithAttrs(cell, {
    rowspan: readCellRowSpan(cell) + extraRowCount,
    vMerge: "restart",
  });
}

/**
 * Reads a positive row span from a cell.
 *
 * @param cell - Source cell.
 * @returns Positive row span.
 */
function readCellRowSpan(cell: PMNode): number {
  const rowspan = cell.attrs.rowspan;

  return Number.isInteger(rowspan) && (rowspan as number) > 0
    ? rowspan as number
    : 1;
}
