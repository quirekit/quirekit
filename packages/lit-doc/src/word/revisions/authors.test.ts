import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { revisionAuthorStreams } from '../../testing/revisions/authors'

it('keeps original revision author slots, duplicate names, empty strings, whitespace and Unicode without formatting work', () => {
  const names = ['Unknown', '作者😀', '', ' ', '作者😀'], bytes = compoundFixture(revisionAuthorStreams(names)), before = bytes.slice()
  const source = inspectDoc(bytes, { includeRevisionAuthors: true })
  expect(source.revisionAuthors).toEqual({ scope: 'revision-author-source', present: true, authors: names })
  expect(source.characterRuns).toBeUndefined()
  expect(source.paragraphs).toBeUndefined()
  expect(inspectDoc(bytes).revisionAuthors).toBeUndefined()
  expect(bytes).toEqual(before)
})

it('distinguishes an absent table from a present empty one without inventing Unknown or a current user', () => {
  expect(inspectDoc(compoundFixture(revisionAuthorStreams()), { includeRevisionAuthors: true }).revisionAuthors)
    .toEqual({ scope: 'revision-author-source', present: false, authors: [] })
  const empty = inspectDoc(compoundFixture(revisionAuthorStreams([])), { includeRevisionAuthors: true })
  expect(empty.revisionAuthors).toEqual({ scope: 'revision-author-source', present: true, authors: [] })
  expect(empty.diagnostics).toContainEqual(expect.objectContaining({ code: 'revision-unknown-author-name-variant' }))
})

it('preserves a nonstandard first name as an explicitly diagnosed source value', () => {
  const result = inspectDoc(compoundFixture(revisionAuthorStreams(['Actual source'])), { includeRevisionAuthors: true })
  expect(result.revisionAuthors?.authors).toEqual(['Actual source'])
  expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'revision-unknown-author-name-variant' }))
})

it('accepts only a completely zero-filled advertised empty directory without synthesizing an author', () => {
  const streams = revisionAuthorStreams([]), fib = new DataView(streams.WordDocument!.buffer)
  const offset = fib.getUint32(154 + 51 * 8, true), table = new Uint8Array(offset + 22)
  table.set(streams['1Table']!.subarray(0, offset)); streams['1Table'] = table
  fib.setUint32(158 + 51 * 8, 22, true)
  const source = inspectDoc(compoundFixture(streams), { includeRevisionAuthors: true })
  expect(source.revisionAuthors).toEqual({ scope: 'revision-author-source', present: true, authors: [] })
  expect(source.diagnostics).toContainEqual(expect.objectContaining({ code: 'revision-author-empty-directory' }))
  table[table.length - 1] = 1
  expect(() => inspectDoc(compoundFixture(streams), { includeRevisionAuthors: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-revision-data' }))
})

it.each(['encoding', 'extra', 'count', 'truncated-string', 'trailing'])(
  'refuses malformed revision metadata independently of plain text storage: %s', kind => {
    const streams = revisionAuthorStreams(['Unknown', 'A']), fib = new DataView(streams.WordDocument!.buffer)
    const offset = fib.getUint32(154 + 51 * 8, true), data = new DataView(streams['1Table']!.buffer)
    if (kind === 'encoding') data.setUint16(offset, 0, true)
    if (kind === 'extra') data.setUint16(offset + 4, 2, true)
    if (kind === 'count') data.setUint16(offset + 2, 0xffff, true)
    if (kind === 'truncated-string') data.setUint16(offset + 6, 1000, true)
    if (kind === 'trailing') {
      const table = new Uint8Array(streams['1Table']!.length + 1); table.set(streams['1Table']!)
      streams['1Table'] = table
      fib.setUint32(158 + 51 * 8, fib.getUint32(158 + 51 * 8, true) + 1, true)
    }
    const bytes = compoundFixture(streams)
    expect(inspectDoc(bytes).scope).toBe('text-storage')
    expect(() => inspectDoc(bytes, { includeRevisionAuthors: true })).toThrow(expect.objectContaining({ code: 'invalid-revision-data' }))
  })

it('checks independent record and aggregate Unicode ceilings before decoding source names', () => {
  const bytes = compoundFixture(revisionAuthorStreams(['Unknown', 'A']))
  for (const limits of [{ maxRevisionAuthors: 1 }, { maxRevisionAuthorCodeUnits: 7 }])
    expect(() => inspectDoc(bytes, { includeRevisionAuthors: true, limits })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  expect(() => inspectDoc(bytes, { includeRevisionAuthors: 'yes' as unknown as boolean }))
    .toThrow(expect.objectContaining({ code: 'invalid-input' }))
})
