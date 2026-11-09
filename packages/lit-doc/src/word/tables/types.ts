import type { DocParagraphBoundary, DocReadDiagnostic } from '../../types'
import type { DocTablePosition } from './position/types'
import type { PropertyOperation } from '../properties/types'

/** Source table topology and compatibility decisions needed to resolve table styles. */
export interface WordTablesSource {
  /** Complete source tables in stable nesting order. */
  tables: readonly DocTable[]
  /** Source compatibility decisions and diagnostics from lazily read styles. */
  diagnostics: readonly DocReadDiagnostic[]
}

/** One directly owned block, retaining the source order within a cell. */
export type DocTableBlock = { kind: 'paragraph' | 'table', index: number }

/** A source cell including its terminating marker and its nested blocks. */
export interface DocTableCell {
  /** Inclusive main-story CP. */
  start: number
  /** Exclusive main-story CP, including the cell terminator. */
  end: number
  /** Direct paragraph indexes and nested table indexes in source order. */
  blocks: DocTableBlock[]
}

/** Source properties that determine whether adjacent rows share a table. */
export interface DocTableIdentity {
  /** Active independent table positioning tuple, absent for an ordinary flow table. */
  position?: DocTablePosition
  /** Explicit resolved style slot, or null when no style was specified. */
  styleIndex: number | null
  /** Source PGP group, or null when absent. */
  group: number | null
  /** Logical direction derived from both source bidi properties. */
  bidi: boolean
}

/** A complete source row, whose separate row marker is not cell content. */
export interface DocTableRow {
  /** Inclusive first cell CP. */
  start: number
  /** Exclusive row-marker CP. */
  end: number
  /** Inclusive CP of the standalone row marker. */
  markerStart: number
  /** Source cells in logical order, including merge continuation cells. */
  cells: DocTableCell[]
  /** Uninterpreted ordinary source operations, excluding admitted structure fields. */
  unsupportedOpcodes: readonly number[]
}

/** One source table; no sizes, merge semantics or final formatting are implied. */
export interface DocTable {
  /** Inclusive first row CP. */
  start: number
  /** Exclusive final row CP. */
  end: number
  /** Source nesting depth, starting at one. */
  level: number
  /** Stable adjacent-row identity after admitted source property application. */
  identity: DocTableIdentity
  /** Rows in source order. */
  rows: DocTableRow[]
  /** Owning outer cell, absent for top-level tables. */
  parent?: { tableIndex: number, rowIndex: number, cellIndex: number }
}

/** One paragraph's direct table role before constructing any topology. */
export interface TableParagraphRole extends DocParagraphBoundary {
  /** Index into the source paragraph inspection array. */
  index: number
  /** Validated source depth. */
  level: number
  /** Standalone row, cell end, ordinary paragraph, or non-table body. */
  role: 'row' | 'cell' | 'paragraph' | 'body'
  /** Complete ordered direct operations for the row authority. */
  operations: readonly PropertyOperation[]
  /** Whether bounded legacy membership supplied an absent outer depth. */
  implicitDepth?: boolean
}

/** One completed row and its separately computed table identity. */
export interface TableRowSource {
  /** Source membership. */
  row: DocTableRow
  /** Boundary properties for grouping consecutive rows. */
  identity: DocTableIdentity
}

/** Document-wide allocation budget shared by independent source table scopes. */
export interface TableAllocationBudget {
  /** Remaining allocations, including tables in a later-refused optional story. */
  remaining: number
}
