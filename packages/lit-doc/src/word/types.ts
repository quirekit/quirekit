import type { DocReadDiagnostic, DocStoryRange, DocTextPiece } from '../types'

/** Shared source-record allocation ceiling, retaining work spent by failed scopes. */
export interface WordAllocationBudget {
  /** Number of additional records that may be allocated. */
  remaining: number
}

/** One FIB locator, kept internally for later semantic readers. */
export interface WordRecordRange {
  /** Stream-relative record byte position. */
  offset: number
  /** Record length in bytes. */
  length: number
}

/** Admitted FIB fields needed by source text and later property interpretation. */
export interface WordHeader {
  /** Effective version, including any newer-version override. */
  version: number
  /** Selected root table stream. */
  tableStream: '0Table' | '1Table'
  /** Meaningful bytes in WordDocument; trailing stream capacity is not content. */
  meaningfulBytes: number
  /** End of all counted FIB regions. */
  headerLength: number
  /** FIB record locators, indexed by their format-defined positions. */
  records: readonly WordRecordRange[]
  /** Raw subdocument character intervals. */
  stories: readonly DocStoryRange[]
  /** Expected final piece-table CP, including any global trailing character. */
  textLength: number
  /** Explicit compatibility decisions made while reading source records. */
  diagnostics: readonly DocReadDiagnostic[]
}

/** A source text piece retaining its unresolved direct-format references. */
export interface TextPieceRecord extends DocTextPiece {
  /** Original Pcd flag word, without synthesizing editing properties. */
  flags: number
  /** Original Prm word; complex values reference the CLX property groups. */
  propertyModifier: number
}

/** Internal source storage, intentionally separate from LitAST or editor state. */
export interface WordTextStorage {
  /** Actual contiguous main-story CP range when damaged storage requires ordinary-text recovery. */
  recoveredRange?: DocStoryRange
  /** Logical text including all source control characters. */
  text: string
  /** Text spans with source property references. */
  pieces: readonly TextPieceRecord[]
  /** Raw CLX property groups, not interpreted or advertised as document preservation. */
  propertyGroups: readonly Uint8Array[]
}
