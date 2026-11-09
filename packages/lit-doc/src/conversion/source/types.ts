import type { DocParagraphBaseFormat } from '../../types'
import type { CharacterPropertyKey, CharacterToggleModes } from '../../word/characters/formatting/types'
import type { DocCharacterRun } from '../../word/characters/types'
import type { WordDocumentSource } from '../../word/document/types'
import type { WordFontRecord } from '../../word/fonts/types'
import type { WordFormattingContext } from '../../word/formatting/types'
import type { ParagraphPropertyKey, ParagraphStyleResolver } from '../../word/paragraphs/formatting/types'
import type { ParagraphNumberingState } from '../../word/numbering/types'
import type { ParagraphSourceRecord } from '../../word/paragraphs/types'
import type { DocTable } from '../../word/tables/types'
import type { PropertyOperation } from '../../word/properties/types'
import type { WordAllocationBudget } from '../../word/types'
import type { ConversionFieldState } from '../fields/types'
import type { ConversionBookmarkState } from '../bookmarks/types'
import type { ConversionRevisionState } from '../revisions/types'
import type { DocRevisionRun } from '../../word/revisions/types'

/** Record allocations shared by every source subdocument, including failed reads. */
export interface ConversionAllocationBudgets {
  /** Remaining paragraph allocations. */
  paragraphs: WordAllocationBudget
  /** Remaining logical character-run allocations. */
  characterRuns: WordAllocationBudget
  /** Remaining table allocations, including partial failed table scopes. */
  tables: WordAllocationBudget
}

/** Immutable document-wide source authorities shared by all subdocuments. */
export interface ConversionDocumentSource extends WordDocumentSource {
  /** Shared original revision authors and document-wide target carrier identities. */
  revisionState: ConversionRevisionState
  /** Once-read standard bookmarks and actual-Story pair accounting. */
  bookmarkState: ConversionBookmarkState
  /** Document-owned field indexes, cell ownership caches and source/traversal ceilings. */
  fieldState: ConversionFieldState
  /** Mutable work counters owned by this complete conversion attempt. */
  allocations: ConversionAllocationBudgets
  /** Privately owned optional Data stream shared by formatting and picture decoding. */
  data: Uint8Array | undefined
  /** Shared immutable styles, font slots and property work budget. */
  context: WordFormattingContext
  /** Complete source font descriptors. */
  fonts: readonly WordFontRecord[]
  /** Shared source style resolver, retaining each definition's own numbering writes. */
  paragraphStyles: ParagraphStyleResolver
}

/** One canonical source story using the document's shared formatting authorities. */
export interface ConversionStorySource extends ConversionDocumentSource {
  /** Original story paragraph boundaries and property authorities. */
  paragraphs: readonly ParagraphSourceRecord[]
  /** Canonical derived paragraph values, parallel to paragraphs. */
  paragraphFormats: readonly DocParagraphBaseFormat[]
  /** Actual surviving direct fields, excluding style inheritance. */
  paragraphFields: readonly ReadonlySet<ParagraphPropertyKey>[]
  /** Final reference values with provenance confined to the paragraph's direct layers. */
  paragraphNumbering: readonly ParagraphNumberingState[]
  /** Canonical derived character settings, preserving source CP cuts. */
  runs: readonly DocCharacterRun[]
  /** Actual surviving direct run fields, parallel to runs. */
  runFields: readonly ReadonlySet<CharacterPropertyKey>[]
  /** Last surviving source toggle operation per run, including relative inheritance. */
  runToggleModes: readonly CharacterToggleModes[]
  /** Direct CHPX then piece operations retained by the single source interpreter. */
  runOperations: readonly (readonly PropertyOperation[])[]
  /** Independent source review actors/date/save sessions aligned one-to-one with runs. */
  runRevisions: readonly DocRevisionRun[]
}

/** Canonical story formatting with admitted table topology. */
export interface ConversionSource extends ConversionStorySource {
  /** Source table topology before geometry or merge projection. */
  tables: readonly DocTable[]
  /** Ordered top-level table intervals for bounded story lookup. */
  topTables: readonly IndexedSourceTable[]
  /** Conversion-only original row operations, captured by the source topology owner. */
  tableRowOperations: ReadonlyMap<number, readonly PropertyOperation[]>
}

/** Ordered top-level source table with its canonical table-array identity. */
export interface IndexedSourceTable extends Pick<DocTable, 'start' | 'end'> {
  /** Stable index used by nested cell blocks and source row operations. */
  index: number
}
