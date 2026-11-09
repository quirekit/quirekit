import {
  Fragment,
  Slice,
  type Node as PMNode
} from "@quirekit/pm";
import {
  createWordTableMap,
  getRectEndRow,
  getRangeEndColumn,
  type WordTableExplicitCellRef
} from "../map";
import type { WordTableSelection } from "../selection";
import { projectWordTableHtml } from "./html";

/**
 * Creates an internal ProseMirror table slice from a structural table selection.
 *
 * @param selection - Structural Word table selection.
 * @returns Slice containing a copied Word table subset.
 */
export function createWordTableSelectionSlice(
  selection: WordTableSelection
): Slice {
  const sourceTable = readSelectedTable(selection);
  const map = createWordTableMap(sourceTable);
  const explicitById = new Map(
    map.explicitCells.map((cell) => [cell.id, cell] as const)
  );
  const rows: PMNode[] = [];

  for (
    let rowIndex = selection.rect.startRow;
    rowIndex < getRectEndRow(selection.rect);
    rowIndex += 1
  ) {
    const sourceRow = sourceTable.child(rowIndex);
    const cells = collectSelectedRowCells({
      sourceTable,
      rowIndex,
      startColumn: selection.rect.startColumn,
      endColumn: getRangeEndColumn(selection.rect),
      explicitById,
      map
    });

    rows.push(sourceRow.type.create(
      normalizeCopiedRowAttrs(sourceRow.attrs),
      cells,
      sourceRow.marks
    ));
  }

  return new Slice(
    Fragment.from(sourceTable.type.create(
      normalizeCopiedTableAttrs(sourceTable.attrs, selection),
      rows,
      sourceTable.marks
    )),
    0,
    0
  );
}

/**
 * Creates the static-display table slice used by semantic external HTML.
 *
 * The internal slice retains explicit Word merge continuation cells for
 * round-trip fidelity. This projection removes only cells covered by a
 * semantic rowspan, allowing schema `toDOM` to produce valid native table
 * structure without maintaining a parallel HTML string serializer.
 *
 * @param selection - Structural Word table selection.
 * @returns Table slice containing only semantic origin cells per row.
 */
export function createWordTableSelectionHtmlSlice(
  selection: WordTableSelection
): Slice {
  const internalSlice = createWordTableSelectionSlice(selection);
  const table = internalSlice.content.firstChild;

  if (!table || table.type.name !== "wordTable") {
    throw new RangeError("Word table HTML projection requires a copied wordTable");
  }
  return new Slice(Fragment.from(projectWordTableHtml(table)), 0, 0);
}

/**
 * Reads the selected table node from the selection document.
 *
 * @param selection - Structural Word table selection.
 * @returns Source table node.
 */
export function readSelectedTable(selection: WordTableSelection): PMNode {
  const table = selection.$anchor.doc.nodeAt(selection.tablePos);

  if (!table || table.type.name !== "wordTable") {
    throw new RangeError("Word table clipboard requires a selected wordTable");
  }

  return table;
}

/**
 * Collects source explicit cells visible in one copied row.
 *
 * @param options - Row collection inputs.
 * @returns Copied cell nodes for the row.
 */
function collectSelectedRowCells(options: {
  readonly sourceTable: PMNode;
  readonly rowIndex: number;
  readonly startColumn: number;
  readonly endColumn: number;
  readonly explicitById: ReadonlyMap<string, WordTableExplicitCellRef>;
  readonly map: ReturnType<typeof createWordTableMap>;
}): readonly PMNode[] {
  const cells: PMNode[] = [];
  const emitted = new Set<string>();

  for (
    let column = options.startColumn;
    column < options.endColumn;
    column += 1
  ) {
    const slot = options.map.slotAt(options.rowIndex, column);

    if (
      slot?.kind !== "cell" ||
      emitted.has(slot.explicitCellId)
    ) {
      continue;
    }

    const explicit = options.explicitById.get(slot.explicitCellId);

    if (!explicit) {
      continue;
    }

    cells.push(readExplicitCellNode(options.sourceTable, explicit));
    emitted.add(explicit.id);
  }

  return cells;
}

/**
 * Reads an explicit source cell node.
 *
 * @param tableNode - Source table node.
 * @param explicit - Explicit cell ref to read.
 * @returns Source cell node.
 */
export function readExplicitCellNode(
  tableNode: PMNode,
  explicit: WordTableExplicitCellRef
): PMNode {
  return tableNode.child(explicit.rowIndex).child(explicit.cellIndex);
}

/**
 * Normalizes copied row attrs so pasted subsets do not preserve outside offsets.
 *
 * @param attrs - Source row attrs.
 * @returns Row attrs for the copied table subset.
 */
function normalizeCopiedRowAttrs(
  attrs: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  return {
    ...attrs,
    gridBefore: 0,
    gridAfter: 0
  };
}

/**
 * Normalizes copied table attrs to the selected grid columns.
 *
 * @param attrs - Source table attrs.
 * @param selection - Structural table selection.
 * @returns Table attrs for the copied table subset.
 */
function normalizeCopiedTableAttrs(
  attrs: Readonly<Record<string, unknown>>,
  selection: WordTableSelection
): Readonly<Record<string, unknown>> {
  return {
    ...attrs,
    grid: sliceArrayAttr(attrs.grid, selection),
    legacyColumns: sliceArrayAttr(attrs.legacyColumns, selection)
  };
}

/**
 * Slices a column-indexed table attr when the attr is array-like.
 *
 * @param value - Source attr value.
 * @param selection - Structural table selection.
 * @returns Sliced attr value or the original value.
 */
function sliceArrayAttr(
  value: unknown,
  selection: WordTableSelection
): unknown {
  return Array.isArray(value)
    ? value.slice(
        selection.rect.startColumn,
        selection.rect.startColumn + selection.rect.columnSpan
      )
    : value;
}
