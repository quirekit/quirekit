import { ByteView } from '../../binary/bytes'
import { readUtf16Units } from '../../binary/strings'
import { requireDoc } from '../../errors'
import type { DocReadDiagnostic, DocReadLimits } from '../../types'
import type { WordHeader } from '../types'
import type { DocBookmarksSource } from './types'
import { readBookmarkPairs } from './ranges'

/**
 * Reads the extended name table without applying a UI authoring validator.
 * @param data - Complete bounded STTB.
 * @param count - Count independently established by both PLCs.
 * @returns Exact names in start-record order.
 */
function readNames(data: ByteView, count: number): string[] {
  requireDoc(data.u16(0) === 0xffff && data.u16(2) === count && data.u16(4) === 0,
    'invalid-bookmark-data', 'Invalid extended bookmark name table or parallel count')
  const names: string[] = [], seen = new Set<string>()
  let offset = 6
  for (let index = 0; index < count; index++) {
    const size = data.u16(offset)
    requireDoc(size > 0 && size <= 40, 'invalid-bookmark-data', 'Invalid bookmark name length')
    const name = readUtf16Units(data, offset + 2, size)
    requireDoc(!seen.has(name), 'invalid-bookmark-data', 'Duplicate source bookmark name')
    seen.add(name)
    names.push(name)
    offset += 2 + size * 2
  }
  requireDoc(offset === data.bytes.length, 'invalid-bookmark-data', 'Unexpected trailing bookmark name data')
  return names
}

/**
 * Reads standard bookmarks once, preserving explicit end-index pairing and raw hints.
 * @param table - FIB-selected table stream.
 * @param header - Validated source locators and all document-part intervals.
 * @param limits - Validated allocation policy.
 * @param diagnostics - Destination for explicitly recovered source conditions.
 * @returns Source-only names, absolute ranges and original descriptors.
 */
export function readBookmarkRecords(table: Uint8Array, header: WordHeader, limits: DocReadLimits,
  diagnostics: DocReadDiagnostic[]): DocBookmarksSource {
  const namesRange = header.records[21]!, startsRange = header.records[22]!, endsRange = header.records[23]!
  if (!namesRange.length && !startsRange.length && !endsRange.length) return { scope: 'bookmark-source', entries: [] }
  const count = (startsRange.length - 4) / 8
  requireDoc(Number.isInteger(count) && count >= 0 && endsRange.length === 4 + count * 4 && namesRange.length >= 6,
    'invalid-bookmark-data', 'Bookmark tables have inconsistent counts or byte lengths')
  requireDoc(count <= limits.maxBookmarks, 'limit-exceeded', 'Bookmark count limit exceeded')
  const stream = new ByteView(table, 'invalid-bookmark-data')
  const names = readNames(new ByteView(stream.slice(namesRange.offset, namesRange.length), 'invalid-bookmark-data'), count)
  const starts = new ByteView(stream.slice(startsRange.offset, startsRange.length), 'invalid-bookmark-data')
  const ends = new ByteView(stream.slice(endsRange.offset, endsRange.length), 'invalid-bookmark-data')
  const maximum = header.stories[header.stories.length - 1]!.end
  const entries = readBookmarkPairs(starts, ends, count, maximum, { allowEquivalentEndIndexes: true })
    .map(({ index, ...pair }) => ({ index, name: names[index]!, ...pair }))
  if (new Set(entries.map(entry => entry.endIndex)).size < count) diagnostics.push({
    code: 'bookmark-equivalent-end-index',
    message: 'Repeated bookmark end indexes retain their original ranges; equal-CP physical endpoints provide complete one-to-one capacity.',
  })
  return { scope: 'bookmark-source', startTerminalCp: starts.u32(count * 4), endTerminalCp: ends.u32(count * 4), entries }
}
