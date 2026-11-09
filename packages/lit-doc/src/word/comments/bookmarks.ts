import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import { readBookmarkPairs } from '../bookmarks/ranges'
import type { WordHeader } from '../types'
import type { DocCommentBookmark } from './types'

/**
 * Connects annotation tags to explicit main-story bookmark ranges.
 * @param table - Selected table stream.
 * @param header - Original source locators and main-story range.
 * @param limits - Comment and format allocation ceilings.
 * @returns Original tagged ranges, independent of comment-reference order.
 */
export function readCommentBookmarks(table: Uint8Array, header: WordHeader, limits: DocReadLimits): DocCommentBookmark[] {
  const tagsRange = header.records[37]!, startsRange = header.records[42]!, endsRange = header.records[43]!
  if (!tagsRange.length && !startsRange.length && !endsRange.length) return []
  const count = (startsRange.length - 4) / 8
  requireDoc(Number.isInteger(count) && count >= 0 && count <= 0x3ffc && endsRange.length === 4 + count * 4
    && tagsRange.length === 6 + count * 12, 'invalid-comment-data', 'Inconsistent annotation bookmark tables')
  requireDoc(count <= limits.maxComments, 'limit-exceeded', 'Annotation bookmark count limit exceeded')
  const stream = new ByteView(table, 'invalid-comment-data')
  const tags = new ByteView(stream.slice(tagsRange.offset, tagsRange.length), 'invalid-comment-data')
  requireDoc(tags.u16(0) === 0xffff && tags.u16(2) === count && tags.u16(4) === 10,
    'invalid-comment-data', 'Invalid annotation tag table header')
  const starts = new ByteView(stream.slice(startsRange.offset, startsRange.length), 'invalid-comment-data')
  const ends = new ByteView(stream.slice(endsRange.offset, endsRange.length), 'invalid-comment-data')
  const pairs = readBookmarkPairs(starts, ends, count, header.stories[0]!.end, { errorCode: 'invalid-comment-data' })
  const seen = new Set<number>()
  return pairs.map(pair => {
    const offset = 6 + pair.index * 12, tag = tags.u32(offset + 4)
    requireDoc(tags.u16(offset) === 0 && tags.u16(offset + 2) === 0x0100 && !seen.has(tag) && pair.columns === null,
      'invalid-comment-data', 'Invalid annotation bookmark tag, class or column state')
    seen.add(tag)
    return { index: pair.index, tag, start: pair.start, end: pair.end, endIndex: pair.endIndex, rawFlags: pair.rawFlags }
  })
}
