import type { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { BookmarkPairOptions, SourceBookmarkPair } from './types'

/**
 * Pairs the independently ordered start and end PLCs for a bookmark family.
 * @param starts - Bounded CP/FBKF table.
 * @param ends - Bounded endpoint-only PLC.
 * @param count - Already budgeted parallel record count.
 * @param maximum - Largest actual content endpoint for this family.
 * @param options - Owning family's error category and bounded recovery policy.
 * @returns Complete source ranges in start order, including original BKC hints.
 */
export function readBookmarkPairs(starts: ByteView, ends: ByteView, count: number, maximum: number,
  options: BookmarkPairOptions = {}): SourceBookmarkPair[] {
  const code = options.errorCode ?? 'invalid-bookmark-data'
  const entries: SourceBookmarkPair[] = [], usedEnds = new Set<number>()
  let previousStart = -1, previousEnd = -1
  // These sequences have independent ordering. Only ibkl connects a start to
  // an end; crossing and coincident ranges are not stack nesting.
  for (let index = 0; index < count; index++) {
    const start = starts.u32(index * 4), orderedEnd = ends.u32(index * 4)
    requireDoc(start >= previousStart && start <= maximum && orderedEnd >= previousEnd && orderedEnd <= maximum,
      code, 'Unordered or out-of-document bookmark CP')
    const descriptor = (count + 1) * 4 + index * 4
    const endIndex = starts.u16(descriptor), rawFlags = starts.u16(descriptor + 2)
    requireDoc(endIndex < count && (options.allowEquivalentEndIndexes || !usedEnds.has(endIndex)),
      code, 'Invalid or repeated bookmark end index')
    const end = ends.u32(endIndex * 4)
    requireDoc(start <= end && end <= maximum, code, 'Reversed or out-of-document bookmark range')
    const columns = rawFlags & 0x8000 ? { first: rawFlags & 0x7f, limit: rawFlags >>> 8 & 0x3f } : null
    requireDoc(!columns || columns.first < columns.limit, code, 'Invalid source bookmark column range')
    entries.push({ index, start, end, endIndex, rawFlags, native: !!(rawFlags & 0x4000), columns })
    usedEnds.add(endIndex)
    previousStart = start
    previousEnd = orderedEnd
  }
  // End records contain only CPs. A duplicate index is recoverable only when
  // every original range can consume a distinct physical endpoint at that CP.
  if (usedEnds.size < count) {
    const remaining = new Map<number, number>()
    for (let index = 0; index < count; index++) {
      const cp = ends.u32(index * 4)
      remaining.set(cp, (remaining.get(cp) ?? 0) + 1)
    }
    for (const entry of entries) {
      const capacity = remaining.get(entry.end) ?? 0
      requireDoc(capacity > 0, code, 'Repeated bookmark index has no equivalent unused endpoint')
      remaining.set(entry.end, capacity - 1)
    }
  }
  return entries
}
