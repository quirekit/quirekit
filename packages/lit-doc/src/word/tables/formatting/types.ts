/** A preferred source dimension, distinct from physical grid edges and content size. */
export interface SourceTableWidth {
  /** Standard width interpretation; percentage values retain 1/50-percent units. */
  type: 'nil' | 'auto' | 'pct' | 'dxa'
  /** Raw source measurement, with ignored nil/auto values normalized to zero. */
  value: number
}

/** A complete source cell's admitted merge and formatting state. */
export interface SourceCellFormat {
  /** Horizontal merge role, retaining source continuation cells. */
  horizontal: 'none' | 'restart' | 'continue'
  /** Vertical merge role, validated against adjacent rows by the table compiler. */
  vertical: 'none' | 'restart' | 'continue'
  /** Preferred width rather than a width inferred from adjacent edges. */
  width: SourceTableWidth | null
  /** Standard text flow spelling. */
  textDirection: string
  /** Source vertical alignment. */
  verticalAlign: 'top' | 'center' | 'bottom'
  /** Whether marker text should fill the available cell width. */
  fitText: boolean
  /** Stored single-line preference, independent of its current layout effect. */
  noWrap: boolean
  /** Whether a completely empty row can suppress cell-mark height. */
  hideMark: boolean
  /** Actual source fields, excluding unexamined table-style contributions. */
  fields: Set<'width' | 'textDirection' | 'verticalAlign' | 'fitText' | 'noWrap' | 'hideMark'>
  /** Whether nonempty legacy border bytes still require a separate projection. */
  unprojectedBorders: boolean
}

/** Row-owned table properties which OOXML may carry as row exceptions. */
export interface SourceRowTableFormat {
  /** Source preferred overall table width, absent without an explicit operation. */
  width: SourceTableWidth | null
  /** Source preferred leading indent, independent of actual row coordinates. */
  indent: SourceTableWidth | null
  /** Logical default or explicitly selected logical/physical alignment. */
  alignment: 'start' | 'center' | 'end' | 'left' | 'right'
  /** Atomic source default is fixed rather than content-driven resizing. */
  layout: 'fixed' | 'autofit'
}

/** Admitted direct row data before grid unification or XML construction. */
export interface SourceRowFormat {
  /** Final logical-page edge coordinates, including the final outer edge. */
  edges: number[]
  /** Every physical source cell, including merge continuations. */
  cells: SourceCellFormat[]
  /** Row-specific table properties, with source defaults kept as one tuple. */
  table: SourceRowTableFormat
  /** Explicit row height; null means no operation selected one. */
  height: { value: number, rule: 'auto' | 'atLeast' | 'exact' } | null
  /** Explicit row split policy, retaining false. */
  cantSplit: boolean | null
  /** Stored repeating-header flag; table-level compilation enforces adjacency. */
  header: boolean | null
  /** Preferred leading omitted-region width. */
  before: SourceTableWidth | null
  /** Preferred trailing omitted-region width. */
  after: SourceTableWidth | null
  /** Last explicit legacy row origin, before its gap-half offset. */
  left: number | null
  /** Legacy origin offset, never treated as actual cell padding. */
  gapHalf: number
  /** Ordinary properties which require later format/styling work. */
  unsupportedOpcodes: number[]
}
