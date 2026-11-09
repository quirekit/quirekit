import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocBookmarkEntry, DocBookmarksSource } from '../../word/bookmarks/types'

/** Document-wide source authority and attempted range accounting. */
export interface ConversionBookmarkState {
  /** Once-read original three-table index. */
  source: DocBookmarksSource
  /** Source pairs already assigned to an actual Story attempt. */
  attempted: Set<number>
}

/** One zero-width event in an actual Story's source coordinates. */
export interface BookmarkProjectionEvent {
  /** Absolute position at which the marker precedes source content. */
  position: number
  /** Original complete paired source range. */
  entry: DocBookmarkEntry
  /** Whether this event starts rather than ends the source pair. */
  start: boolean
}

/** Ordered paragraph marker owner with atomic pair omission. */
export interface BookmarkProjection {
  /** @param position - Current source CP. @param inInstruction - Any ancestor field-code context. @param inField - Open field ownership, including result caches. @returns Zero-width paragraph children at this exact source boundary. */
  at(position: number, inInstruction: boolean, inField: boolean): DocxXmlElementPlan[]
  /** @param end - Current source run/paragraph limit. @returns Next event or that unchanged limit. */
  next(end: number): number
  /** @param blocks - Complete actual Story output. @returns Output with both ends of unadmitted ranges removed. */
  finish(blocks: DocxXmlElementPlan[]): DocxXmlElementPlan[]
}
