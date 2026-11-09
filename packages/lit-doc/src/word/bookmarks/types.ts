import type { DocReadErrorCode } from '../../types'

/** Family-specific validation policy for the shared bookmark range reader. */
export interface BookmarkPairOptions {
  /** Owning domain's stable malformed-data category. */
  errorCode?: DocReadErrorCode
  /** Accept repeated indexes only when their endpoint CP capacities equal the physical table. */
  allowEquivalentEndIndexes?: boolean
}

/** Source table-column interval, whose end is exclusive. */
export interface DocBookmarkColumns {
  /** First source column, zero based. */
  first: number
  /** First source column outside this bookmark. */
  limit: number
}

/** One standard bookmark paired through its explicit source end-table index. */
export interface DocBookmarkEntry {
  /** Stable position in the source name/start tables. */
  index: number
  /** Exact source UTF-16 name, including hidden prefixes and original case. */
  name: string
  /** Inclusive absolute CP in concatenated document-part storage. */
  start: number
  /** Exclusive absolute CP, possibly equal to start for an empty bookmark. */
  end: number
  /** Explicit index into the independently ordered end table. */
  endIndex: number
  /** Complete original BKC word, including bits the format says to ignore. */
  rawFlags: number
  /** Original application hint to retain the bookmark in XML/HTML/RTF exports. */
  native: boolean
  /** Source column range only when the original fCol flag is set. */
  columns: DocBookmarkColumns | null
}

/** Shared binary range descriptor before a family attaches names or annotation tags. */
export type SourceBookmarkPair = Omit<DocBookmarkEntry, 'name'>

/** Source-only standard bookmark index, independent of editor coordinates. */
export interface DocBookmarksSource {
  /** Declares the source bookmark contract. */
  scope: 'bookmark-source'
  /** Ignored final start PLC sentinel, never used as a content endpoint. */
  startTerminalCp?: number
  /** Ignored final end PLC sentinel, never used as a content endpoint. */
  endTerminalCp?: number
  /** Bookmarks in nondecreasing start order, with explicitly paired ends. */
  entries: readonly DocBookmarkEntry[]
}
