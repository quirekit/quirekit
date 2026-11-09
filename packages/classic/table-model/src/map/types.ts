/** Role of an explicit source cell inside the resolved table map. */
export type WordTableCellRole =
  | "origin"
  | "horizontalContinuation"
  | "verticalContinuation"
  | "malformedContinuation";

/** Stable diagnostic codes emitted by `WordTableMap`. */
export type WordTableMapDiagnosticCode =
  | "hmerge-orphan-continue"
  | "hmerge-continuation-content"
  | "hmerge-vertical-role-mismatch"
  | "row-grid-overflow"
  | "row-grid-underflow"
  | "grid-span-colspan-mismatch"
  | "vmerge-orphan-continue"
  | "vmerge-range-mismatch"
  | "vmerge-overlap"
  | "vmerge-restart-over-open-chain"
  | "vmerge-continuation-content"
  | "header-body-vmerge-crossing"
  | "duplicate-grid-slot"
  | "invalid-grid-offset";

/** Horizontal range in the Word table grid. */
export interface WordTableGridRange {
  /** Zero-based starting column. */
  readonly startColumn: number;
  /** Number of columns covered by the range. */
  readonly columnSpan: number;
}

/** Rectangular region in the Word table grid. */
export interface WordTableGridRect extends WordTableGridRange {
  /** Zero-based starting row. */
  readonly startRow: number;
  /** Number of rows covered by the rect. */
  readonly rowSpan: number;
}

/** Row offset columns represented by `gridBefore` or `gridAfter`. */
export interface WordTableGridOffsetRef extends WordTableGridRange {
  /** Offset side represented by this ref. */
  readonly side: "before" | "after";
}

/** Row ref derived from a source `wordTableRow` node. */
export interface WordTableRowRef {
  /** Runtime row id stable within one map build. */
  readonly id: string;
  /** Zero-based source row index. */
  readonly rowIndex: number;
  /** Table-relative ProseMirror position of the row node. */
  readonly rowPos: number;
  /** Omitted grid columns before the first explicit cell. */
  readonly gridBefore: WordTableGridOffsetRef;
  /** Omitted grid columns after the last explicit cell. */
  readonly gridAfter: WordTableGridOffsetRef;
  /** Declared table grid width visible to this row. */
  readonly declaredGridWidth: number;
  /** Grid width occupied by offsets and explicit cells. */
  readonly occupiedGridWidth: number;
  /** Whether this row repeats as a Word header row. */
  readonly isHeader: boolean;
  /** Whether this row should avoid page splitting. */
  readonly cantSplit: boolean;
}

/** Explicit cell ref derived from a source `wordTableCell` node. */
export interface WordTableExplicitCellRef {
  /** Runtime explicit cell id stable within one map build. */
  readonly id: string;
  /** Runtime id of the owning row. */
  readonly rowId: string;
  /** Runtime id of the semantic cell that owns this explicit cell. */
  readonly semanticCellId: string | null;
  /** Explicit cell role inside the semantic map. */
  readonly role: WordTableCellRole;
  /** Zero-based source row index. */
  readonly rowIndex: number;
  /** Zero-based cell index inside the source row. */
  readonly cellIndex: number;
  /** Table-relative ProseMirror position of the explicit cell node. */
  readonly cellPos: number;
  /** Horizontal grid range occupied by the explicit cell. */
  readonly range: WordTableGridRange;
  /** Effective grid span used for placement. */
  readonly gridSpan: number;
  /** Word vertical merge marker on this explicit cell. */
  readonly vMerge: "restart" | "continue" | null;
  /** Whether the explicit cell has meaningful textual content. */
  readonly hasMeaningfulContent: boolean;
}

/** Semantic cell ref used by selection, clipboard, and layout consumers. */
export interface WordTableSemanticCellRef {
  /** Runtime semantic cell id stable within one map build. */
  readonly id: string;
  /** Explicit origin cell id. */
  readonly originExplicitCellId: string;
  /** Explicit continuation cell ids owned by this semantic cell. */
  readonly continuationExplicitCellIds: readonly string[];
  /** Grid rect occupied by the semantic cell. */
  readonly rect: WordTableGridRect;
  /** Table-relative ProseMirror position of the origin explicit cell. */
  readonly originCellPos: number;
  /** Horizontal grid span of the semantic cell. */
  readonly gridSpan: number;
  /** Vertical row span of the semantic cell. */
  readonly rowSpan: number;
  /** Whether the semantic cell was formed without diagnostics. */
  readonly wellFormed: boolean;
}

/** Grid slot occupied by a semantic cell. */
export interface WordTableCellGridSlot {
  /** Slot kind discriminator. */
  readonly kind: "cell";
  /** Zero-based row index. */
  readonly rowIndex: number;
  /** Zero-based column index. */
  readonly columnIndex: number;
  /** Semantic cell id occupying this slot. */
  readonly semanticCellId: string;
  /** Explicit cell id visible in this source row. */
  readonly explicitCellId: string;
  /** Role of this slot within the semantic cell. */
  readonly role: "origin" | "horizontalSpan" | "verticalContinuation" | "covered";
}

/** Grid slot represented by Word row offsets. */
export interface WordTableRowOffsetGridSlot {
  /** Slot kind discriminator. */
  readonly kind: "rowOffset";
  /** Zero-based row index. */
  readonly rowIndex: number;
  /** Zero-based column index. */
  readonly columnIndex: number;
  /** Offset side that owns this grid slot. */
  readonly side: "before" | "after";
}

/** Grid slot with no source cell or row offset. */
export interface WordTableMissingGridSlot {
  /** Slot kind discriminator. */
  readonly kind: "missing";
  /** Zero-based row index. */
  readonly rowIndex: number;
  /** Zero-based column index. */
  readonly columnIndex: number;
}

/** Slot in the resolved Word table grid. */
export type WordTableGridSlot =
  | WordTableCellGridSlot
  | WordTableRowOffsetGridSlot
  | WordTableMissingGridSlot;

/** Diagnostic emitted while deriving a Word table map. */
export interface WordTableMapDiagnostic {
  /** Stable diagnostic code. */
  readonly code: WordTableMapDiagnosticCode;
  /** Human-readable diagnostic message. */
  readonly message: string;
  /** Zero-based row index when the diagnostic is row-local. */
  readonly rowIndex: number | null;
  /** Zero-based cell index when the diagnostic is cell-local. */
  readonly cellIndex: number | null;
  /** Grid range involved in the diagnostic, when available. */
  readonly range: WordTableGridRange | null;
  /** Grid rect involved in the diagnostic, when available. */
  readonly rect: WordTableGridRect | null;
  /** Explicit cell ids involved in the diagnostic. */
  readonly explicitCellIds: readonly string[];
  /** Semantic cell ids involved in the diagnostic. */
  readonly semanticCellIds: readonly string[];
}

/** Derived map for a single `wordTable` node. */
export interface WordTableMap {
  /** Canonical grid width. */
  readonly width: number;
  /** Number of source rows. */
  readonly height: number;
  /** Row refs in source order. */
  readonly rows: readonly WordTableRowRef[];
  /** Explicit cell refs in source order. */
  readonly explicitCells: readonly WordTableExplicitCellRef[];
  /** Semantic cell refs in source order. */
  readonly semanticCells: readonly WordTableSemanticCellRef[];
  /** Flattened row-major grid slots. */
  readonly slots: readonly WordTableGridSlot[];
  /** Diagnostics found while deriving the map. */
  readonly diagnostics: readonly WordTableMapDiagnostic[];
  /**
   * Finds an explicit cell by table-relative position.
   *
   * @param cellPos - Table-relative explicit cell position.
   * @returns Explicit cell ref, or null.
   */
  findExplicitCell(cellPos: number): WordTableExplicitCellRef | null;
  /**
   * Finds the semantic cell that owns an explicit cell position.
   *
   * @param cellPos - Table-relative explicit cell position.
   * @returns Semantic cell ref, or null.
   */
  findSemanticCell(cellPos: number): WordTableSemanticCellRef | null;
  /**
   * Gets the semantic cell occupying a visible grid slot.
   *
   * @param row - Zero-based row index.
   * @param column - Zero-based column index.
   * @returns Semantic cell ref, or null for offsets and missing slots.
   */
  cellAt(row: number, column: number): WordTableSemanticCellRef | null;
  /**
   * Gets a grid slot by coordinates.
   *
   * @param row - Zero-based row index.
   * @param column - Zero-based column index.
   * @returns Grid slot, or null when coordinates are outside the map.
   */
  slotAt(row: number, column: number): WordTableGridSlot | null;
  /**
   * Gets unique semantic cells intersecting a rect.
   *
   * @param rect - Rect to inspect.
   * @returns Semantic cells in source order.
   */
  cellsInRect(rect: WordTableGridRect): readonly WordTableSemanticCellRef[];
  /**
   * Computes the smallest rect containing two semantic cells.
   *
   * @param anchorCellPos - Table-relative anchor explicit cell position.
   * @param headCellPos - Table-relative head explicit cell position.
   * @returns Grid rect, or null when either position is unresolved.
   */
  rectBetween(anchorCellPos: number, headCellPos: number): WordTableGridRect | null;
  /**
   * Expands a rect so partially intersected merged cells are selected atomically.
   *
   * @param rect - Rect to expand.
   * @returns Expanded rect.
   */
  expandRectToMergedCells(rect: WordTableGridRect): WordTableGridRect;
  /**
   * Gets the origin explicit cell position for a grid slot.
   *
   * @param row - Zero-based row index.
   * @param column - Zero-based column index.
   * @returns Table-relative origin cell position, or null.
   */
  positionAt(row: number, column: number): number | null;
  /**
   * Gets semantic cells intersecting one row.
   *
   * @param row - Zero-based row index.
   * @returns Semantic cells in source order.
   */
  rowCells(row: number): readonly WordTableSemanticCellRef[];
  /**
   * Gets semantic cells intersecting one column.
   *
   * @param column - Zero-based column index.
   * @returns Semantic cells in source order.
   */
  columnCells(column: number): readonly WordTableSemanticCellRef[];
}
