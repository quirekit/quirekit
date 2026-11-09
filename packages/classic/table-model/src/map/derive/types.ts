import type { Node as PMNode } from '@quirekit/pm'
import type { MutableExplicitCellRef, SemanticResolutionOptions } from './internal'

/** One physical row cell with its original persistent node and derived source identity. */
export interface ExplicitRowCell {
  /** Original canonical node, never rewritten by map derivation. */
  readonly node: PMNode
  /** Source position and grid interval established before semantic grouping. */
  readonly explicit: MutableExplicitCellRef
}

/** Shared semantic owners, vertical chains and diagnostics for a complete source row. */
export type RowSemanticResolutionOptions = Omit<SemanticResolutionOptions, 'explicitCell'>
