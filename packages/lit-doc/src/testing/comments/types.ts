/** Explicit original comment-reference and content facts. */
export interface CommentFixture {
  /** Main-story reference CP. */
  anchor: number
  /** Complete message text, including its final paragraph mark. */
  text: string
  /** Source author-table slot, defaulting to zero. */
  authorIndex?: number
  /** Exact initials, defaulting to an empty buffer. */
  initials?: string
  /** Original annotation tag; FFFFFFFF denotes a point. */
  bookmarkTag?: number
}

/** Independently authored annotation bookmark descriptor. */
export interface CommentBookmarkFixture {
  /** Original unique ATNBE tag. */
  tag: number
  /** Main-story start CP. */
  start: number
  /** Explicit independently ordered end slot. */
  endIndex: number
  /** Original BKC word. */
  rawFlags?: number
}

/** Explicit optional 18-byte extension record. */
export interface CommentExtraFixture {
  /** Original packed minute-resolution DTTM. */
  timestamp?: number
  /** Original zero-based thread depth. */
  depth?: number
  /** Signed record distance to the parent. */
  parentDelta?: number
  /** Original packed extension flags. */
  flags?: number
}

/** Source-directory and deliberate malformed-vector variations. */
export interface CommentFixtureOptions {
  /** Effective source format version, defaulting to Word 2002. */
  version?: number
  /** Exact original author names. */
  authors?: readonly string[]
  /** Annotation tags and start descriptors. */
  bookmarks?: readonly CommentBookmarkFixture[]
  /** Independent end CP sequence. */
  ends?: readonly number[]
  /** Optional original extensions, including deliberate bad counts. */
  extras?: readonly CommentExtraFixture[]
}

/** Independently authored source formatting interval. */
export interface CommentPropertySpan {
  /** First absolute source CP. */
  start: number
  /** Exclusive absolute source CP. */
  end: number
  /** Encoded original property operations. */
  operations: readonly number[]
}

/** Complete binary comment document with optional source formatting. */
export interface CommentDocumentOptions extends CommentFixtureOptions {
  /** Explicit source paragraph operations. */
  paragraphs?: readonly CommentPropertySpan[]
  /** Explicit run operations, overriding automatic control CFSpec. */
  characters?: readonly CommentPropertySpan[]
}
