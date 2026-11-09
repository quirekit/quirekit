import type { DocParagraphBoundary } from '../../types'

/** Borrowed source paragraph properties; interpretation belongs to a later semantic pass. */
export interface ParagraphPropertyRecord {
  /** Inclusive physical FC relative to WordDocument; a defaulted record spans only its validated marker. */
  byteStart: number
  /** Exclusive physical FC; a defaulted marker span provides no original FKP endpoint authority. */
  byteEnd: number
  /** Empty style-zero properties synthesized only when no original interval covers the validated marker. */
  defaulted?: true
  /** Original style-table index; zero for an absent property record. */
  styleIndex: number
  /** Uninterpreted property bytes after the style index, including any indirect references. */
  properties: Uint8Array
}

/** Internal paragraph source carrying the end marker's formatting authority. */
export interface ParagraphSourceRecord extends DocParagraphBoundary {
  /** PAPX record selected by the ending marker, not the paragraph's first character. */
  formatting: ParagraphPropertyRecord
  /** Logical text piece containing the ending marker. */
  pieceIndex: number
  /** The ending piece's original Prm, to apply after PAPX in a later semantic pass. */
  propertyModifier: number
  /** Whether the ending marker also ends the shared physical formatting record. */
  endsFormattingRecord: boolean
}

/** Bounded lookup into paragraph formatting storage. */
export interface ParagraphPropertyIndex {
  /**
   * Locates a record covering the complete source character.
   * @param byteOffset - WordDocument FC of the character.
   * @param width - Encoded character width, one or two bytes.
   * @returns Original paragraph property record.
   */
  locate(byteOffset: number, width: number): ParagraphPropertyRecord
}
