/** Independently declared source bookmark descriptor. */
export interface BookmarkFixture {
  /** Original UTF-16 name in start-table order. */
  name: string
  /** Absolute source start. */
  start: number
  /** Explicit end-table slot, which need not equal this bookmark's slot. */
  endIndex: number
  /** Original BKC bits; defaults to the persistent noncolumn hint. */
  rawFlags?: number
}

/** Original endpoints and deliberately malformed table variants. */
export interface BookmarkTableFixture {
  /** Start records in their authored order. */
  entries: readonly BookmarkFixture[]
  /** End CPs in independently declared end-table order. */
  ends: readonly number[]
  /** Optional start-table sentinel. */
  startTerminal?: number
  /** Optional end-table sentinel. */
  endTerminal?: number
  /** Optional string-table extension marker. */
  extend?: number
  /** Optional string-table count override. */
  nameCount?: number
  /** Optional per-name extra-data declaration. */
  extraBytes?: number
}
