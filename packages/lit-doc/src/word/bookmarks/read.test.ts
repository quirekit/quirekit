import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { wordStreams } from '../../testing/word'
import { withBookmarkTables } from '../../testing/bookmarks/document'
import type { BookmarkTableFixture } from '../../testing/bookmarks/types'

const crossing: BookmarkTableFixture = { entries: [
  { name: 'Outer', start: 1, endIndex: 1 }, { name: 'Inner', start: 2, endIndex: 0 },
  { name: '_隐藏', start: 2, endIndex: 2, rawFlags: 0x8281 },
], ends: [4, 7, 7] }

/** @param tables - Explicit source tables. @returns Complete immutable original input. */
function fixture(tables: BookmarkTableFixture = crossing): Uint8Array {
  const streams = wordStreams([{ units: [65, 66, 67, 68, 69, 70, 71, 72, 13], unicode: true }])
  return compoundFixture(withBookmarkTables(streams, tables))
}

it('pairs by the descriptor end index and retains exact UTF-16 names, flags and ignored sentinels', () => {
  const bytes = fixture(), before = bytes.slice()
  const result = inspectDoc(bytes, { includeBookmarks: true })
  expect(result.bookmarks).toEqual({ scope: 'bookmark-source', startTerminalCp: 0xffffffff, endTerminalCp: 0xffffffff,
    entries: [
      { index: 0, name: 'Outer', start: 1, end: 7, endIndex: 1, rawFlags: 0x4000, native: true, columns: null },
      { index: 1, name: 'Inner', start: 2, end: 4, endIndex: 0, rawFlags: 0x4000, native: true, columns: null },
      { index: 2, name: '_隐藏', start: 2, end: 7, endIndex: 2, rawFlags: 0x8281, native: false, columns: { first: 1, limit: 2 } },
    ] })
  expect(result.paragraphs).toBeUndefined()
  expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'bookmark-projection-unresolved' }))
  expect(inspectDoc(bytes).bookmarks).toBeUndefined()
  expect(bytes).toEqual(before)
})

it('supports empty and overlapping bookmarks and every document part using absolute CPs', () => {
  const streams = wordStreams([{ units: [65, 13, 66, 13, 67, 13, 68, 13, 69, 13, 70, 13, 71, 13, 13], unicode: false }],
    { storyLengths: [2, 2, 2, 2, 2, 2, 2] })
  const entries = Array.from({ length: 7 }, (_, index) => ({ name: `Name${index}`, start: index * 2, endIndex: index }))
  const result = inspectDoc(compoundFixture(withBookmarkTables(streams, { entries, ends: entries.map(entry => entry.start) })), { includeBookmarks: true })
  expect(result.bookmarks?.entries.map(entry => [entry.start, entry.end])).toEqual(entries.map(entry => [entry.start, entry.start]))
})

it('distinguishes absent and explicitly empty tables', () => {
  const empty = inspectDoc(fixture({ entries: [], ends: [] }), { includeBookmarks: true })
  expect(empty.bookmarks).toMatchObject({ entries: [], startTerminalCp: 0xffffffff, endTerminalCp: 0xffffffff })
  const absent = inspectDoc(compoundFixture(wordStreams([{ units: [65, 13], unicode: false }])), { includeBookmarks: true })
  expect(absent.bookmarks).toEqual({ scope: 'bookmark-source', entries: [] })
})

it.each<BookmarkTableFixture>([
  { entries: [{ name: 'A', start: 1, endIndex: 0 }, { name: 'B', start: 1, endIndex: 0 }], ends: [4, 4] },
  { entries: [{ name: 'A', start: 0, endIndex: 1 }, { name: 'Empty', start: 2, endIndex: 1 }], ends: [2, 2] },
  { entries: [{ name: 'A', start: 1, endIndex: 1, rawFlags: 0 }, { name: 'B', start: 2, endIndex: 1, rawFlags: 0xc281 }], ends: [4, 4] },
  { entries: [{ name: 'A', start: 1, endIndex: 0 }, { name: 'B', start: 2, endIndex: 0 },
    { name: 'C', start: 3, endIndex: 0 }], ends: [4, 4, 4] },
])('retains raw duplicate indexes only when physical endpoint capacities are equivalent %#', tables => {
  const bytes = fixture(tables), before = bytes.slice()
  const result = inspectDoc(bytes, { includeBookmarks: true })
  expect(result.bookmarks?.entries.map(entry => [entry.name, entry.start, entry.end, entry.endIndex, entry.rawFlags]))
    .toEqual(tables.entries.map(entry => [entry.name, entry.start, tables.ends[entry.endIndex], entry.endIndex, entry.rawFlags ?? 0x4000]))
  expect(result.diagnostics.filter(item => item.code === 'bookmark-equivalent-end-index')).toHaveLength(1)
  expect(inspectDoc(bytes).diagnostics.some(item => item.code === 'bookmark-equivalent-end-index')).toBe(false)
  expect(bytes).toEqual(before)
})

it.each([
  { entries: [{ name: 'A', start: 1, endIndex: 0 }, { name: 'B', start: 2, endIndex: 0 },
    { name: 'C', start: 3, endIndex: 0 }], ends: [4, 4, 5] },
  { entries: [{ name: 'A', start: 1, endIndex: 1 }, { name: 'B', start: 2, endIndex: 1 }], ends: [3, 4] },
  { entries: [{ name: 'A', start: 1, endIndex: 0 }, { name: 'B', start: 5, endIndex: 0 }], ends: [4, 4] },
])('rejects duplicate indexes with insufficient endpoint capacity or reversed ranges %#', tables => {
  expect(() => inspectDoc(fixture(tables), { includeBookmarks: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-bookmark-data' }))
})

it.each([
  { ...crossing, nameCount: 2 }, { ...crossing, extend: 0 }, { ...crossing, extraBytes: 1 },
  { ...crossing, ends: [4, 7] }, { ...crossing, ends: [7, 4, 7] }, { ...crossing, ends: [4, 7, 10] },
  { entries: [{ name: '', start: 1, endIndex: 0 }], ends: [2] },
  { entries: [{ name: 'A'.repeat(41), start: 1, endIndex: 0 }], ends: [2] },
  { entries: [{ name: 'A', start: 1, endIndex: 0 }, { name: 'A', start: 2, endIndex: 1 }], ends: [3, 4] },
  { entries: [{ name: 'A', start: 1, endIndex: 0 }, { name: 'B', start: 2, endIndex: 0 }], ends: [3, 4] },
  { entries: [{ name: 'A', start: 1, endIndex: 1 }], ends: [2] },
  { entries: [{ name: 'A', start: 3, endIndex: 0 }], ends: [2] },
  { entries: [{ name: 'A', start: 3, endIndex: 0 }, { name: 'B', start: 2, endIndex: 1 }], ends: [4, 5] },
  { entries: [{ name: 'A', start: 1, endIndex: 0, rawFlags: 0x8182 }], ends: [3] },
])('rejects malformed names, counts, pairs and CPs %# without breaking plain storage inspection', tables => {
  const bytes = fixture(tables)
  expect(inspectDoc(bytes).text).toBe('ABCDEFGH\r')
  expect(() => inspectDoc(bytes, { includeBookmarks: true })).toThrow(expect.objectContaining({ code: 'invalid-bookmark-data' }))
})

it('bounds bookmark allocation and validates the public option', () => {
  expect(() => inspectDoc(fixture(), { includeBookmarks: true, limits: { maxBookmarks: 2 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  expect(() => inspectDoc(fixture(), { includeBookmarks: 'yes' as unknown as boolean }))
    .toThrow(expect.objectContaining({ code: 'invalid-input' }))
})

it.each([21, 22, 23])('refuses a missing or truncated bookmark table at FIB %s', record => {
  for (const truncated of [false, true]) {
    const streams = withBookmarkTables(wordStreams([{ units: [65, 66, 67, 68, 69, 70, 71, 72, 13], unicode: true }]), crossing)
    const fib = new DataView(streams.WordDocument!.buffer), offset = 158 + record * 8
    fib.setUint32(offset, truncated ? fib.getUint32(offset, true) - 1 : 0, true)
    const bytes = compoundFixture(streams)
    expect(inspectDoc(bytes).text).toBe('ABCDEFGH\r')
    expect(() => inspectDoc(bytes, { includeBookmarks: true })).toThrow(expect.objectContaining({ code: 'invalid-bookmark-data' }))
  }
})
