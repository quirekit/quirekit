import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { commentStreams } from '../../testing/comments/document'
import type { CommentFixture, CommentFixtureOptions } from '../../testing/comments/types'

const comments: CommentFixture[] = [{ anchor: 1, text: '\u0005One\r', initials: 'A' },
  { anchor: 3, text: 'Two\r', authorIndex: 1, bookmarkTag: 7 }]
const options: CommentFixtureOptions = { authors: ['甲', 'B'], bookmarks: [{ tag: 7, start: 0, endIndex: 0 }], ends: [3],
  extras: [{ timestamp: 0x26d6b3ae }, { depth: 1, parentDelta: -1, flags: 2 }] }

/** @param records - Independently authored original references. @param settings - Source directory variations. @param main - Authored main text. @returns Complete original input. */
function fixture(records = comments, settings = options, main = 'A\u0005B\u0005\r'): Uint8Array {
  return compoundFixture(commentStreams(main, records, settings))
}

it('keeps exact authors, point/range metadata, full message boundaries and distinct raw thread/date flags', () => {
  const bytes = fixture(), before = bytes.slice(), actual = inspectDoc(bytes, { includeComments: true })
  expect(actual.comments).toEqual({ scope: 'comment-source', authors: ['甲', 'B'], bookmarks: [
    { index: 0, tag: 7, start: 0, end: 3, endIndex: 0, rawFlags: 0x4000 },
  ], entries: [
    { index: 0, anchor: 1, start: 5, end: 10, authorIndex: 0, author: '甲', initials: 'A', bookmarkTag: 0xffffffff, range: null,
      extra: { rawTimestamp: 0x26d6b3ae, depth: 0, parentDelta: 0, parentIndex: null, rawFlags: 0, ink: false } },
    { index: 1, anchor: 3, start: 10, end: 14, authorIndex: 1, author: 'B', initials: '', bookmarkTag: 7,
      range: { index: 0, tag: 7, start: 0, end: 3, endIndex: 0, rawFlags: 0x4000 },
      extra: { rawTimestamp: 0, depth: 1, parentDelta: -1, parentIndex: 0, rawFlags: 2, ink: true } },
  ] })
  expect(actual.paragraphs).toBeUndefined()
  expect(actual.diagnostics).toContainEqual(expect.objectContaining({ code: 'comment-formatting-unresolved' }))
  expect(inspectDoc(bytes).comments).toBeUndefined()
  expect(bytes).toEqual(before)
})

it('does not invent extensions, trim initials or drop content lacking a leading self marker', () => {
  const source = inspectDoc(fixture([{ anchor: 1, text: 'Prefix\u0005Body\r', initials: ' ABC ' }], { authors: ['Person'] }), { includeComments: true })
  expect(source.comments?.entries[0]).toMatchObject({ initials: ' ABC ', start: 5, end: 17, extra: null, range: null })
  expect(source.text.slice(5, 17)).toBe('Prefix\u0005Body\r')
})

it('accepts a parent stored later and ignores declared extension padding without changing the original bits', () => {
  const source = inspectDoc(fixture(comments, { ...options, extras: [{ depth: 1, parentDelta: 1, flags: 0xfffffffd }, {}] }), { includeComments: true })
  expect(source.comments?.entries.map(entry => entry.extra?.parentIndex)).toEqual([1, null])
  expect(source.comments?.entries[0]?.extra).toMatchObject({ depth: 1, rawFlags: 0xfffffffd, ink: false })
})

it.each([
  { records: [{ ...comments[0]!, anchor: 0 }], main: 'A\u0005B\u0005\r' },
  { records: [{ ...comments[0]!, text: 'Missing ending' }] },
  { records: [{ ...comments[0]!, initials: '0123456789' }] },
  { records: [{ ...comments[0]!, authorIndex: 2 }] },
  { records: [comments[0]!, { ...comments[1]!, anchor: 1 }] },
  { settings: { ...options, authors: ['Same', 'Same'] } },
  { settings: { ...options, authors: ['A'.repeat(56), 'B'] } },
  { settings: { ...options, bookmarks: [{ tag: 8, start: 0, endIndex: 0 }] } },
  { settings: { ...options, ends: [6] } },
  { settings: { ...options, bookmarks: [{ tag: 7, start: 0, endIndex: 1 }] } },
  { settings: { ...options, extras: [{}] } },
  { settings: { ...options, extras: [{ depth: 1, parentDelta: -1 }, {}] } },
  { settings: { ...options, extras: [{}, { depth: 1, parentDelta: 1 }] } },
  { settings: { ...options, extras: [{}, { depth: 2, parentDelta: -1 }] } },
])('rejects malformed references, content, authors or relations %# without hiding plain storage', vector => {
  const records = vector.records ?? comments
  const settings = vector.settings ?? { ...options, ...(options.extras ? { extras: options.extras.slice(0, records.length) } : {}) }
  const bytes = fixture(records, settings, vector.main)
  expect(inspectDoc(bytes).scope).toBe('text-storage')
  expect(() => inspectDoc(bytes, { includeComments: true })).toThrow(expect.objectContaining({ code: 'invalid-comment-data' }))
})

it('bounds comments, authors and tree depth independently', () => {
  for (const limits of [{ maxComments: 1 }, { maxCommentAuthors: 1 }, { maxCommentDepth: 1 }]) {
    expect(() => inspectDoc(fixture(), { includeComments: true, limits })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  }
  expect(() => inspectDoc(fixture(), { includeComments: 'yes' as unknown as boolean })).toThrow(expect.objectContaining({ code: 'invalid-input' }))
})

it('keeps annotation endpoint indexes unique even when repeated endpoints have equal CPs', () => {
  const bytes = fixture([{ anchor: 1, text: 'One\r', bookmarkTag: 7 }, { anchor: 3, text: 'Two\r', bookmarkTag: 8 }], {
    authors: ['A'], bookmarks: [{ tag: 7, start: 0, endIndex: 0 }, { tag: 8, start: 1, endIndex: 0 }], ends: [3, 3],
  })
  expect(() => inspectDoc(bytes, { includeComments: true })).toThrow(expect.objectContaining({ code: 'invalid-comment-data' }))
})
