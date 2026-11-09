/** Original annotation bookmark paired independently of comment-reference order. */
export interface DocCommentBookmark {
  /** Source position in the annotation start/tag tables. */
  index: number
  /** Unique original ATNBE tag referenced by comment records. */
  tag: number
  /** Inclusive absolute main-story CP. */
  start: number
  /** Exclusive absolute main-story CP. */
  end: number
  /** Explicit slot in the annotation end table. */
  endIndex: number
  /** Original BKC word, including format-ignored hints. */
  rawFlags: number
}

/** Optional original extension, retaining a packed date without inventing a timezone. */
export interface DocCommentExtra {
  /** Original DTTM bits; zero/ignored and invalid values remain distinguishable. */
  rawTimestamp: number
  /** Zero-based source thread depth. */
  depth: number
  /** Signed source record distance to the parent. */
  parentDelta: number
  /** Independently validated parent slot, or null for a root. */
  parentIndex: number | null
  /** Original extension flags, including ignored padding. */
  rawFlags: number
  /** Whether the source declares an ink comment. */
  ink: boolean
}

/** Source reference, message interval and original metadata before formatting resolution. */
export interface DocCommentEntry {
  /** Source reference slot and stable comment identity input. */
  index: number
  /** Absolute main-story reference-control CP. */
  anchor: number
  /** Inclusive absolute message-body CP. */
  start: number
  /** Exclusive message-body CP, including its own final paragraph mark. */
  end: number
  /** Original author-table index. */
  authorIndex: number
  /** Exact original author name. */
  author: string
  /** Exact used initials code units, without trimming or expanding. */
  initials: string
  /** Original lTagBkmk value, including FFFFFFFF for a point comment. */
  bookmarkTag: number
  /** Exact independently paired range, or null for a point comment. */
  range: DocCommentBookmark | null
  /** Original extension when present in an applicable source version. */
  extra: DocCommentExtra | null
}

/** Source-only comment graph, independent of editor coordinates and rich-message conversion. */
export interface DocCommentsSource {
  /** Declares source indexes rather than a persistent editor registry. */
  scope: 'comment-source'
  /** Exact source authors in their original table order. */
  authors: readonly string[]
  /** Complete annotation bookmarks, including any unused source entries. */
  bookmarks: readonly DocCommentBookmark[]
  /** References and complete bodies in source order. */
  entries: readonly DocCommentEntry[]
}
