/** One source note reference and its complete author-content interval. */
export interface DocNoteRange {
  /** Independent footnote or endnote family. */
  kind: 'footnote' | 'endnote'
  /** Zero-based source slot within this family, independent of displayed numbering. */
  index: number
  /** Main-story reference position in absolute UTF-16 code units. */
  anchor: number
  /** Inclusive absolute content position in concatenated source storage. */
  start: number
  /** Exclusive content endpoint, including the note's own final paragraph mark. */
  end: number
  /** Original two-byte selector, with zero reserved for a custom reference. */
  referenceValue: number
  /** Whether the source selector requests automatic numbering. */
  autoNumbered: boolean
}

/** Bounded source note index, before character formatting or persistent conversion. */
export interface DocNotesSource {
  /** Declares the source-only index contract. */
  scope: 'note-source'
  /** Footnotes followed by endnotes, each in original source order. */
  entries: readonly DocNoteRange[]
}
