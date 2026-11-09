import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocTableBlock } from '../../word/tables/types'
import type { SourceRowFormat } from '../../word/tables/formatting'

/** One validated row projected onto the table's common coordinate grid. */
export interface CompiledTableRow {
  /** Source direct settings, before any host-specific presentation. */
  source: SourceRowFormat
  /** Omitted grid columns before its first explicit source cell. */
  before: number
  /** Omitted grid columns following its last explicit source cell. */
  after: number
  /** Source cells' exact spans over the shared grid. */
  spans: readonly number[]
  /** Effective repeating-header state after enforcing the contiguous prefix. */
  header: boolean | null
}

/** A complete geometry candidate, validated before XML or retention diagnostics. */
export interface CompiledTableGeometry {
  /** Logical page coordinate used as the shared table origin. */
  origin: number
  /** Final logical-page coordinate, avoiding repeated full-grid summation per row. */
  end: number
  /** Positive widths of all unified coordinate intervals. */
  grid: readonly number[]
  /** Validated rows in source order. */
  rows: readonly CompiledTableRow[]
}

/** Existing body owner, reused for cell content and nested tables. */
export type ProjectTableCellBlocks = (blocks: readonly DocTableBlock[]) => DocxXmlElementPlan[]
