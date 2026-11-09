import type { DocReadDiagnostic } from '../../types'

/** Validated stylesheet contents and any bounded source compatibility decisions. */
export interface WordStylesSource {
  /** Fixed source slots, including empty reserved definitions. */
  styles: readonly (WordStyleRecord | undefined)[]
  /** Decisions made while following the source record lengths. */
  diagnostics: readonly DocReadDiagnostic[]
}

/** Source style metadata and its still-uninterpreted paragraph property list. */
export interface WordStyleRecord {
  /** Borrowed UTF-16 name bytes without the terminator; decoded only for conversion. */
  nameBytes: Uint8Array
  /** Borrowed GRFSTD and optional later control metadata, not yet semantically projected. */
  metadataBytes: Uint8Array
  /** Next paragraph style slot; 0xFFF means no source reference. */
  next: number
  /** Built-in source style identity; 0xFFE denotes a user-defined style. */
  builtinId: number
  /** Original UPX groups, including kind-specific headers and unparsed table/list data. */
  propertySets: readonly Uint8Array[]
  /** Source style kind: paragraph, character, table or numbering. */
  kind: number
  /** Parent slot, with 0xFFF meaning no parent. */
  parent: number
  /** Paragraph UPX bytes after its style index; empty for non-paragraph styles. */
  paragraph: Uint8Array
  /** Character UPX bytes for paragraph and character styles. */
  character: Uint8Array
}

/** Default source font indexes from STSHI, without resolving a font table or script. */
export interface WordFontDefaults {
  /** ASCII font slot. */
  ascii: number
  /** East Asian font slot. */
  eastAsia: number
  /** Other-script font slot. */
  other: number
  /** Optional complex-script slot; null leaves automatic selection unresolved. */
  complex: number | null
}
