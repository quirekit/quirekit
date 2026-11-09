/** Source level data without evaluating marker text or its effective formatting. */
export interface DocNumberingLevel {
  /** Zero-based list level. */
  index: number
  /** Original signed start field, including conditionally ignored values. */
  rawStartAt: number
  /** Effective source start, or null for bullet/none formats without a sequence. */
  startAt: number | null
  /** Original MSONFC code; retaining a code does not admit its display algorithm. */
  numberFormat: number
  /** Left, center or right as source codes 0, 1 or 2. */
  alignment: number
  /** Whether inherited number formats use legal numbering. */
  legal: boolean
  /** First level that does not trigger restart; null uses the source default. */
  restartLimit: number | null
  /** Conditionally stored removal indent, in twips. */
  savedIndentTwips: number | null
  /** Whether a temporary bidirectional format was converted. */
  converted: boolean
  /** Tentative level in a hybrid definition; null when the flag must be ignored. */
  tentative: boolean | null
  /** Tab, space or nothing as source codes 0, 1 or 2. */
  suffix: number
  /** HTML incompatibility flags. */
  htmlFlags: number
  /** Exact UTF-16 template, retaining source control units. */
  template: string
  /** One-based template offsets before the first terminating zero. */
  placeholderOffsets: readonly number[]
  /** Opaque paragraph property bytes, copied without execution. */
  paragraphProperties: Uint8Array
  /** Opaque marker character property bytes, copied without execution. */
  characterProperties: Uint8Array
  /** Original independent 28-byte fixed header, including ignored fields. */
  headerBytes: Uint8Array
}

/** Source abstract list definition; identifiers are not editor identities. */
export interface DocNumberingDefinition {
  /** Signed original identity shared by list instances. */
  sourceId: number
  /** Original UI template code; ignored semantically for hybrid lists. */
  templateCode: number
  /** Nine source paragraph-style slots; 0x0fff means no linked style. */
  styleIndexes: readonly number[]
  /** Whether the definition has one level rather than nine. */
  simple: boolean
  /** Whether the definition participates in automatic numbering fields. */
  autoNumbered: boolean
  /** Whether unused levels may be tentative. */
  hybrid: boolean
  /** HTML incompatibility flags. */
  htmlFlags: number
  /** Levels in source order. */
  levels: readonly DocNumberingLevel[]
  /** Original independent 28-byte fixed header. */
  headerBytes: Uint8Array
}

/** One actual source-level override, whose position is not its level identity. */
export interface DocNumberingOverride {
  /** Actual zero-based target level. */
  level: number
  /** Original signed start, even when ignored. */
  rawStartAt: number
  /** Whether the source start override flag is set. */
  hasStartOverride: boolean
  /** Whether a complete replacement level follows. */
  hasFormatting: boolean
  /** Active start-only override; null when inactive or superseded by formatting. */
  startOverride: number | null
  /** Complete replacement level, or null for a start-only or inactive record. */
  formatting: DocNumberingLevel | null
  /** HTML incompatibility flags. */
  htmlFlags: number
  /** Original independent eight-byte fixed header. */
  headerBytes: Uint8Array
}

/** Source concrete list instance. */
export interface DocNumberingInstance {
  /** One-based source position, as used by paragraph references. */
  index: number
  /** Source definition identity. */
  sourceId: number
  /** Zero-based position in the definitions array. */
  definitionIndex: number
  /** Recorded first main-story paragraph CP; null for the ignored sentinel. */
  firstParagraphCp: number | null
  /** Source automatic-field type, without executing the field. */
  autoNumberField: number
  /** HTML incompatibility flags. */
  htmlFlags: number
  /** Ordered overrides retaining their actual level numbers. */
  overrides: readonly DocNumberingOverride[]
  /** Original independent 16-byte fixed header. */
  headerBytes: Uint8Array
}

/** Global numbering records, excluding derived paragraph state. */
export interface DocNumberingRecords {
  /** Abstract definitions in original order, including unused definitions. */
  definitions: readonly DocNumberingDefinition[]
  /** Concrete instances in original order. */
  instances: readonly DocNumberingInstance[]
}

/** Explicit source inspection scope, distinct from persistent editor support. */
export interface DocNumberingSource extends DocNumberingRecords {
  /** Declares unresolved source semantics rather than evaluated list markers. */
  scope: 'numbering-source'
}

/** Source paragraph reference after style, PAPX and ending-piece overrides. */
export interface DocParagraphNumbering {
  /** Original unsigned list-reference bits; distinguishes removal and no-list sentinels. */
  rawIndex: number
  /** Original unsigned level, including ignored values outside a list. */
  rawLevel: number
  /** Normalized one-based instance index, or null outside a list. */
  instanceIndex: number | null
  /** Active level 0..8 or skip value 12; null outside a list. */
  level: number | null
  /** Whether a negative reference preserves logical left and first-line indentation. */
  keepLogicalIndentation: boolean
}

/** Mutable raw reference state captured by the single paragraph-property interpreter. */
export interface ParagraphNumberingState {
  /** Original unsigned source reference bits. */
  rawIndex: number
  /** Original unsigned source level. */
  rawLevel: number
  /** Whether this layer actually writes the instance reference, excluding inherited provenance. */
  referenceChanged?: boolean
  /** Whether this layer actually writes the level, excluding inherited provenance. */
  levelChanged?: boolean
}

/** Shared allocation budgets for base and replacement levels. */
export interface NumberingBudget {
  /** Consumes one level before constructing its result. */
  consumeLevel(): void
  /**
   * Consumes exact template units before decoding them.
   * @param count - Number of source UTF-16 units.
   */
  consumeText(count: number): void
}
