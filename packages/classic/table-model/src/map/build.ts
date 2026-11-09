import type { Node as PMNode } from "@quirekit/pm";
import {
  getDeclaredGridWidth,
  readGridOffset
} from "./derive/attrs";
import {
  createExplicitCellRef,
  freezeExplicitCell
} from "./derive/cell";
import type {
  MutableExplicitCellRef,
  MutableSemanticCellRef,
  OpenVerticalMergeChain,
  RowSlotMap
} from "./derive/internal";
import { createWordTableMapFromData } from "./query";
import { reportRowWidthDiagnostics } from "./derive/row-diagnostics";
import { resolveHorizontalMergeGroups } from "./derive/horizontal-merge";
import type { ExplicitRowCell } from "./derive/types";
import { closeNonAdjacentChains } from "./derive/vertical-merge";
import { freezeSemanticCell } from "./derive/semantic-cell";
import {
  createFinalSlots,
  fillCellSlots,
  fillRowOffsetSlots
} from "./derive/slots";
import type {
  WordTableMap,
  WordTableMapDiagnostic,
  WordTableRowRef
} from "./types";

/**
 * Creates a derived Word table map from a `wordTable` ProseMirror node.
 *
 * @param tableNode - Source `wordTable` node.
 * @returns Derived table map.
 */
export function createWordTableMap(tableNode: PMNode): WordTableMap {
  const declaredGridWidth = getDeclaredGridWidth(tableNode);
  const diagnostics: WordTableMapDiagnostic[] = [];
  const rows: WordTableRowRef[] = [];
  const explicitCells: MutableExplicitCellRef[] = [];
  const semanticCells: MutableSemanticCellRef[] = [];
  const semanticById = new Map<string, MutableSemanticCellRef>();
  const rowSlotMaps: RowSlotMap[] = [];
  const openChains = new Map<string, OpenVerticalMergeChain>();
  let width = declaredGridWidth;

  tableNode.forEach((rowNode, rowOffset, rowIndex) => {
    // Merge ownership may only cross adjacent source rows. Offsets, missing
    // slots and malformed continuations must not keep an older chain alive.
    closeNonAdjacentChains(openChains, semanticById, rowIndex);
    const rowSlots: RowSlotMap = new Map();
    const rowId = `row:r${rowIndex}`;
    const rowPos = rowOffset + 1;
    const gridBeforeCount = readGridOffset(
      rowNode.attrs,
      "gridBefore",
      rowIndex,
      diagnostics
    );
    let cursor = gridBeforeCount;

    fillRowOffsetSlots(rowSlots, rowIndex, 0, gridBeforeCount, "before");

    const rowCells: ExplicitRowCell[] = [];
    rowNode.forEach((cellNode, cellOffset, cellIndex) => {
      const explicitCell = createExplicitCellRef({
        rowId,
        rowIndex,
        cellIndex,
        cellPos: rowPos + cellOffset + 1,
        startColumn: cursor,
        cellNode,
        diagnostics
      });
      rowCells.push({ node: cellNode, explicit: explicitCell });
      cursor += explicitCell.range.columnSpan;
    });
    // Physical placement precedes ownership, so a horizontal group's complete
    // interval is available before it participates in a vertical merge chain.
    resolveHorizontalMergeGroups(rowCells, {
      rowIsHeader: rowNode.attrs.isHeader === true,
      semanticCells, semanticById, openChains, diagnostics
    });
    for (const { explicit } of rowCells) {
      fillCellSlots(rowSlots, explicit, semanticById.get(explicit.semanticCellId!)!, diagnostics);
      explicitCells.push(explicit);
    }

    const gridAfterCount = readGridOffset(
      rowNode.attrs,
      "gridAfter",
      rowIndex,
      diagnostics
    );
    const occupiedGridWidth = cursor + gridAfterCount;

    fillRowOffsetSlots(rowSlots, rowIndex, cursor, gridAfterCount, "after");
    width = Math.max(width, occupiedGridWidth);
    rows.push(createRowRef({
      rowId,
      rowIndex,
      rowPos,
      gridBeforeCount,
      gridAfterCount,
      gridAfterStartColumn: cursor,
      declaredGridWidth,
      occupiedGridWidth,
      isHeader: rowNode.attrs.isHeader === true,
      cantSplit: rowNode.attrs.cantSplit === true
    }));
    rowSlotMaps.push(rowSlots);
    reportRowWidthDiagnostics(
      rowIndex,
      declaredGridWidth,
      occupiedGridWidth,
      diagnostics
    );
  });

  return createWordTableMapFromData({
    width,
    height: rows.length,
    rows,
    explicitCells: explicitCells.map(freezeExplicitCell),
    semanticCells: semanticCells.map(freezeSemanticCell),
    slots: createFinalSlots(rowSlotMaps, rows.length, width),
    diagnostics
  });
}

/**
 * Creates a row ref from measured row placement data.
 *
 * @param options - Row placement data.
 * @returns Row ref.
 */
function createRowRef(options: {
  readonly rowId: string;
  readonly rowIndex: number;
  readonly rowPos: number;
  readonly gridBeforeCount: number;
  readonly gridAfterCount: number;
  readonly gridAfterStartColumn: number;
  readonly declaredGridWidth: number;
  readonly occupiedGridWidth: number;
  readonly isHeader: boolean;
  readonly cantSplit: boolean;
}): WordTableRowRef {
  return {
    id: options.rowId,
    rowIndex: options.rowIndex,
    rowPos: options.rowPos,
    gridBefore: {
      side: "before",
      startColumn: 0,
      columnSpan: options.gridBeforeCount
    },
    gridAfter: {
      side: "after",
      startColumn: options.gridAfterStartColumn,
      columnSpan: options.gridAfterCount
    },
    declaredGridWidth: options.declaredGridWidth,
    occupiedGridWidth: options.occupiedGridWidth,
    isHeader: options.isHeader,
    cantSplit: options.cantSplit
  };
}
