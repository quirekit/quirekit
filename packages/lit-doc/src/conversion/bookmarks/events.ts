import type { DocBookmarkEntry } from '../../word/bookmarks/types'
import type { BookmarkProjectionEvent } from './types'

/**
 * Finds the first start at or after one actual Story boundary.
 * @param entries - Original nondecreasing source starts.
 * @param position - Absolute source boundary.
 * @returns First candidate index, or the array length.
 */
export function firstBookmark(entries: readonly DocBookmarkEntry[], position: number): number {
  let lower = 0, upper = entries.length
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2)
    if (entries[middle]!.start < position) lower = middle + 1
    else upper = middle
  }
  return lower
}

/**
 * Orders coincident ranges without imposing a nesting stack on crossing bookmarks.
 * @param entries - Complete admitted actual-Story candidates in source order.
 * @returns End-before-start events, with adjacent start/end for each empty pair.
 */
export function bookmarkEvents(entries: readonly DocBookmarkEntry[]): BookmarkProjectionEvent[] {
  const groups = new Map<number, { starts: DocBookmarkEntry[], ends: DocBookmarkEntry[] }>()
  /** @param cp - Absolute source boundary. @returns Existing or newly allocated event bucket. */
  function group(cp: number) {
    let value = groups.get(cp)
    if (!value) { value = { starts: [], ends: [] }; groups.set(cp, value) }
    return value
  }
  for (const entry of entries) {
    group(entry.start).starts.push(entry)
    if (entry.end !== entry.start) group(entry.end).ends.push(entry)
  }
  return [...groups].sort(([left], [right]) => left - right).flatMap(([position, value]) => [
    ...value.ends.map(entry => ({ position, entry, start: false })),
    ...value.starts.flatMap(entry => [{ position, entry, start: true },
      ...(entry.end === entry.start ? [{ position, entry, start: false }] : [])]),
  ])
}
