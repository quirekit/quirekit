/** Independently authored note-index test vector. */
export interface NoteVector {
  /** Main-story UTF-16 reference position. */
  anchor: number
  /** Complete note text, including its own paragraph ending. */
  text: string
  /** Raw two-byte selector; zero selects a custom marker. */
  referenceValue?: number
}

/** Exact source formatting span in an independently authored note document. */
export interface NotePropertySpan {
  /** Inclusive absolute source CP. */
  start: number
  /** Exclusive absolute source CP. */
  end: number
  /** Independently encoded property operations. */
  operations: readonly number[]
}

/** Optional explicit formatting overrides for note conversion vectors. */
export interface NoteDocumentOptions {
  /** Source paragraph properties selected at each paragraph ending. */
  paragraphs?: readonly NotePropertySpan[]
  /** Source run properties overriding the fixture's automatic U+0002 CFSpec records. */
  characters?: readonly NotePropertySpan[]
}
