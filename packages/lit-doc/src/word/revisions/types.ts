/** Original revision-author table, independent of content flags and current users. */
export interface DocRevisionAuthorsSource {
  /** Declares source author slots rather than editable revision objects. */
  scope: 'revision-author-source'
  /** Whether the source FIB actually contains this table, including a present empty table. */
  present: boolean
  /** Exact original UTF-16 names in index order, retaining duplicate/empty/whitespace values. */
  authors: readonly string[]
}

/** Original actor and date operands for one independent insertion or deletion. */
export interface DocRevisionActorSource {
  /** Signed source author slot, with zero as the specified absent-operation default. */
  authorIndex: number
  /** Whether an author operand was actually stored for this source range. */
  authorExplicit: boolean
  /** Exact unsigned DTTM when explicitly stored, or null when no operand exists. */
  rawTimestamp: number | null
  /** Exact unsigned reason operand, or null when not explicitly stored. */
  reason: number | null
}

/** Original revision state over one complete character-source interval, including controls. */
export interface DocRevisionRun {
  /** Inclusive absolute source UTF-16 CP. */
  start: number
  /** Exclusive absolute source UTF-16 CP. */
  end: number
  /** Final inserted flag from the canonical character interpreter. */
  inserted: boolean
  /** Final deleted flag from the canonical character interpreter. */
  deleted: boolean
  /** Insertion author/date/reason, independent of deletion metadata. */
  insertion: DocRevisionActorSource
  /** Deletion author/date/reason, independent of insertion metadata. */
  deletion: DocRevisionActorSource
  /** Original insertion save-session id; it is not a business change identifier. */
  insertionSaveId: number | null
  /** Original deletion save-session id. */
  deletionSaveId: number | null
  /** Original formatting save-session id, without interpreting a property revision. */
  formattingSaveId: number | null
}

/** Main-story source revision states, without persistent editor review decisions. */
export interface DocRevisionsSource {
  /** Explicitly limits this graph to original main-story revision metadata. */
  scope: 'main-story-revision-source'
  /** Exact source author directory, including its presence and original slots. */
  authors: DocRevisionAuthorsSource
  /** Complete source character intervals in CP order, including inactive metadata. */
  runs: readonly DocRevisionRun[]
}
