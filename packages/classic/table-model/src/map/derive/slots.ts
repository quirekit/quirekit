import { createWordTableMapDiagnostic } from "../diagnostics";
import { getRangeEndColumn } from "../range";
import type { MutableExplicitCellRef, MutableSemanticCellRef, RowSlotMap } from "./internal";
import type {
  WordTableCellGridSlot,
  WordTableGridSlot,
  WordTableMapDiagnostic
} from "../types";

/**
 * Fills slots for one explicit source cell.
 *
 * @param rowSlots - Mutable row slot map.
 * @param explicitCell - Explicit cell ref.
 * @param semanticCell - Owning semantic rectangle, independent of physical cell intervals.
 * @param diagnostics - Mutable diagnostics output.
 */
export function fillCellSlots(
  rowSlots: RowSlotMap,
  explicitCell: MutableExplicitCellRef,
  semanticCell: MutableSemanticCellRef,
  diagnostics: WordTableMapDiagnostic[]
): void {
  for (
    let column = explicitCell.range.startColumn;
    column < getRangeEndColumn(explicitCell.range);
    column += 1
  ) {
    setSlot(rowSlots, {
      kind: "cell",
      rowIndex: explicitCell.rowIndex,
      columnIndex: column,
      semanticCellId: semanticCell.id,
      explicitCellId: explicitCell.id,
      role: getSlotRole(explicitCell, semanticCell, column)
    }, diagnostics);
  }
}

/**
 * Fills row offset slots.
 *
 * @param rowSlots - Mutable row slot map.
 * @param rowIndex - Source row index.
 * @param startColumn - First offset column.
 * @param count - Number of columns to fill.
 * @param side - Offset side.
 */
export function fillRowOffsetSlots(
  rowSlots: RowSlotMap,
  rowIndex: number,
  startColumn: number,
  count: number,
  side: "before" | "after"
): void {
  for (let column = startColumn; column < startColumn + count; column += 1) {
    rowSlots.set(column, {
      kind: "rowOffset",
      rowIndex,
      columnIndex: column,
      side
    });
  }
}

/**
 * Creates final row-major slots after the table width is known.
 *
 * @param rowSlotMaps - Row-local slot maps.
 * @param height - Number of source rows.
 * @param width - Canonical grid width.
 * @returns Flattened row-major slots.
 */
export function createFinalSlots(
  rowSlotMaps: readonly RowSlotMap[],
  height: number,
  width: number
): WordTableGridSlot[] {
  const slots: WordTableGridSlot[] = [];

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const rowSlots = rowSlotMaps[rowIndex] ?? new Map<number, WordTableGridSlot>();

    for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
      slots.push(rowSlots.get(columnIndex) ?? {
        kind: "missing",
        rowIndex,
        columnIndex
      });
    }
  }

  return slots;
}

/**
 * Sets a grid slot and emits a duplicate diagnostic when occupied.
 *
 * @param rowSlots - Mutable row slot map.
 * @param slot - Slot to set.
 * @param diagnostics - Mutable diagnostics output.
 */
function setSlot(
  rowSlots: RowSlotMap,
  slot: WordTableCellGridSlot,
  diagnostics: WordTableMapDiagnostic[]
): void {
  if (rowSlots.has(slot.columnIndex)) {
    diagnostics.push(createWordTableMapDiagnostic({
      code: "duplicate-grid-slot",
      message: "Multiple table cells occupy the same grid slot.",
      rowIndex: slot.rowIndex,
      range: { startColumn: slot.columnIndex, columnSpan: 1 },
      explicitCellIds: [slot.explicitCellId],
      semanticCellIds: [slot.semanticCellId]
    }));
  }

  rowSlots.set(slot.columnIndex, slot);
}

/**
 * Gets the slot role for a cell-owned grid slot.
 *
 * @param explicitCell - Explicit cell that owns the slot.
 * @param semanticCell - Complete owner rectangle across all physical members.
 * @param column - Column index for the slot.
 * @returns Slot role.
 */
function getSlotRole(
  explicitCell: MutableExplicitCellRef,
  semanticCell: MutableSemanticCellRef,
  column: number
): WordTableCellGridSlot["role"] {
  if (explicitCell.rowIndex > semanticCell.rect.startRow) {
    return column === semanticCell.rect.startColumn
      ? "verticalContinuation"
      : "covered";
  }

  return column === semanticCell.rect.startColumn ? "origin" : "horizontalSpan";
}
