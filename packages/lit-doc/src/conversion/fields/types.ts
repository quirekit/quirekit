import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocReadError } from '../../errors'
import type { DocStoryKind } from '../../types'
import type { DocFieldEntry, DocFieldIndex } from '../../word/fields/types'
import type { DocTableCell } from '../../word/tables/types'
import type { WordAllocationBudget } from '../../word/types'

/** Once-read field index with constant-time source-token identity lookups. */
export interface ConversionFieldIndex {
  /** Original part-relative index and absolute paired entries. */
  source: DocFieldIndex
  /** Entries keyed by their absolute begin position. */
  begins: ReadonlyMap<number, DocFieldEntry>
  /** Entries keyed by their absolute separator position. */
  separators: ReadonlyMap<number, DocFieldEntry>
  /** Entries keyed by the absolute end-control position. */
  ends: ReadonlyMap<number, DocFieldEntry>
}

/** Document-owned caches and work ceilings, shared by every attempted Story. */
export interface ConversionFieldState {
  /** Complete source indexes or known failures, read once per document part. */
  indexes: Map<DocStoryKind, ConversionFieldIndex | DocReadError>
  /** Field allocations spent by source-index reads, including failed parts. */
  indexed: WordAllocationBudget
  /** Actual text-field allocations, including unindexed fields and failed Stories. */
  projected: WordAllocationBudget
  /** Closest cell per paragraph, cached once per canonical aggregate source. */
  cells: WeakMap<object, ReadonlyMap<number, DocTableCell>>
}

/** Active raw-text field whose marker identity and owner must remain coherent. */
export interface FieldProjectionFrame {
  /** Whether this field's structure is admitted rather than a resource display fallback. */
  preserveStructure: boolean
  /** An unsupported child in ancestor code cannot substitute its cache into that instruction. */
  omitWholeField: boolean
  /** Absolute source begin position. */
  start: number
  /** Observed separator, or null while the field remains in its code region. */
  separator: number | null
  /** Exact indexed metadata when this source field belongs to its PLC. */
  entry: DocFieldEntry | undefined
  /** Closest physical cell owner; undefined denotes ordinary Story flow. */
  cell: DocTableCell | undefined
}

/** Independent actual-Story field state consumed by the ordered inline producer. */
export interface FieldProjection {
  /** Whether a source field frame currently owns the next boundary, including cached results. */
  readonly inField: boolean
  /** Whether any active ancestor is still in its instruction region. */
  readonly inInstruction: boolean
  /** Whether an unsupported resource field owns this code region, including its children. */
  readonly omitInstruction: boolean
  /** Runs whose field controls were consumed by this owner. */
  handledRuns: ReadonlySet<number>
  /** @param index - Canonical paragraph slot. Checks instruction continuity and enters its cell scope. */
  enterParagraph(index: number): void
  /** @param position - Absolute source control CP. @param code - Original control kind. @returns Typed complex-field marker, absent for a diagnosed resource fallback. */
  project(position: number, code: 19 | 20 | 21): DocxXmlElementPlan | undefined
  /** Rejects a Story whose source field stack did not close. */
  finish(): void
}
