import type { DocStoryRange } from '../../types'

/** Original two-byte field record and its document-part-relative CP interval. */
export interface DocFieldToken {
  /** Position of the actual field control relative to its document part. */
  relativePosition: number
  /** Next PLC position; the final value is undefined source metadata, not a text bound. */
  nextRelativePosition: number
  /** Complete first byte, including the three reserved bits that readers ignore. */
  rawCode: number
  /** Begin, separator or end control, respectively 19, 20 or 21. */
  code: 19 | 20 | 21
  /** Original historical field type, ignored separator payload or end flags. */
  value: number
}

/** Distinct source end flags, without assuming equivalence to OOXML attributes. */
export interface DocFieldFlags {
  /** Complete original end-state byte. */
  raw: number
  /** Reverses the document-level instruction/result display setting. */
  differ: boolean
  /** Result contains an OLE object despite the field type not generating one. */
  zombieEmbed: boolean
  /** Results were edited or formatted after their last calculation. */
  resultsDirty: boolean
  /** Results were edited after their last calculation. */
  resultsEdited: boolean
  /** Prevents recalculation of this field. */
  locked: boolean
  /** Cached result is not intended to be visible. */
  privateResult: boolean
  /** Original assertion that this field belongs to another field. */
  nested: boolean
  /** Original assertion that this field contains a separator. */
  hasSeparator: boolean
}

/** Paired indexed field; unindexed enclosing fields remain outside this contract. */
export interface DocFieldEntry {
  /** Inclusive absolute source position of the begin control. */
  start: number
  /** Exclusive absolute source position after the end control. */
  end: number
  /** Absolute separator position, or null when this field has no result. */
  separator: number | null
  /** One-based depth among indexed fields, distinct from complete text nesting. */
  indexDepth: number
  /** Field kind recorded the last time a source application parsed its instruction. */
  lastParsedType: number
  /** Original end flags kept independently of the observed marker topology. */
  flags: DocFieldFlags
}

/** One document part's complete source field index, including empty parts. */
export interface DocFieldIndex extends DocStoryRange {
  /** Undefined final PLC position, retained only when an index physically exists. */
  terminalCp?: number
  /** Raw records in original source order. */
  tokens: readonly DocFieldToken[]
  /** Paired fields in begin order, with absolute content positions. */
  entries: readonly DocFieldEntry[]
}

/** Source-only indexes; does not evaluate instructions or resolve character flags. */
export interface DocFieldsSource {
  /** Declares the source index contract. */
  scope: 'field-index-source'
  /** All seven document parts in source storage order. */
  indexes: readonly DocFieldIndex[]
}
