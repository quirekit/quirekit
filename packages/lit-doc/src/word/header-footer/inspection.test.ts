import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { headerFooterStreams } from '../../testing/header-footer'
import { wordStreams } from '../../testing/word'

it('keeps the absent header directory explicit without requiring unrelated paragraph records', () => {
  const bytes = compoundFixture(wordStreams([{ units: [65, 13], unicode: false }]))
  expect(inspectDoc(bytes).headerFooters).toBeUndefined()
  expect(inspectDoc(bytes, { includeHeaderFooters: true }).headerFooters).toEqual({
    scope: 'header-footer-source', evenAndOddHeaders: null, positions: [], separators: [], stories: [],
  })
})

it('reads absolute source coordinates, six variants and guards while ignoring the undefined final PLC value', () => {
  const bytes = compoundFixture(headerFooterStreams([['', '页眉\r\r', '', 'Footer\r\r', '\r\r', '']],
    { evenAndOdd: true, footnoteText: 'Note\r' }))
  const result = inspectDoc(bytes, { includeHeaderFooters: true })
  const source = result.headerFooters!
  expect(source.scope).toBe('header-footer-source')
  expect(source.evenAndOddHeaders).toBe(true)
  expect(source.positions).toHaveLength(13)
  expect(source.separators).toHaveLength(6)
  expect(source.stories).toHaveLength(6)
  const header = source.stories[1]!
  expect(header).toEqual({ section: 0, kind: 'header', variant: 'default', start: 19, end: 23, contentEnd: 22 })
  expect(result.text.slice(header.start, header.contentEnd)).toBe('页眉\r')
  expect(source.stories[0]!.start).toBe(source.stories[0]!.end)
  expect(source.stories[4]!.end - source.stories[4]!.start).toBe(2)
  expect(source.stories[4]!.contentEnd - source.stories[4]!.start).toBe(1)
})

it('preserves empty inherited slots separately from explicit blank stories in later sections', () => {
  const result = inspectDoc(compoundFixture(headerFooterStreams([
    ['', 'Header\r\r', '', 'Footer\r\r', '', ''],
    ['', '', '', '\r\r', '', ''],
  ])), { includeHeaderFooters: true }).headerFooters!
  expect(result.stories).toHaveLength(12)
  expect(result.stories[7]).toMatchObject({ section: 1, kind: 'header', variant: 'default' })
  expect(result.stories[7]!.end - result.stories[7]!.start).toBe(0)
  expect(result.stories[9]!.end - result.stories[9]!.start).toBe(2)
})

it.each(['order', 'extent', 'count', 'guard'] as const)('refuses invalid header %s without changing plain storage inspection', kind => {
  const streams = headerFooterStreams([['', 'Header\r\r', '', '', '', '']])
  const word = new DataView(streams.WordDocument!.buffer)
  const offset = word.getUint32(154 + 11 * 8, true)
  const table = new DataView(streams['1Table']!.buffer)
  if (kind === 'order') table.setUint32(offset + 2 * 4, 2, true)
  if (kind === 'extent') table.setUint32(offset + 12 * 4, 999, true)
  if (kind === 'count') word.setUint32(158 + 11 * 8, 52, true)
  if (kind === 'guard') word.setUint16(2048 + (2 + 12 + 7) * 2, 65, true)
  const bytes = compoundFixture(streams)
  expect(inspectDoc(bytes).scope).toBe('text-storage')
  expect(() => inspectDoc(bytes, { includeHeaderFooters: true })).toThrow(expect.objectContaining({ code: 'invalid-story-data' }))
})

it('bounds even empty slots and validates the public option before reading', () => {
  const bytes = compoundFixture(headerFooterStreams([['', '', '', '', '', '']]))
  expect(() => inspectDoc(bytes, { includeHeaderFooters: true, limits: { maxHeaderFooterStories: 11 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  expect(() => inspectDoc(bytes, { includeHeaderFooters: 1 as unknown as boolean }))
    .toThrow(expect.objectContaining({ code: 'invalid-input' }))
  expect(inspectDoc(bytes, { includeHeaderFooters: true, limits: { maxHeaderFooterStories: 12 } }).headerFooters!.stories).toHaveLength(6)
})

it('ignores an unused stale directory only when the declared header text is empty and reports compatibility', () => {
  const streams = wordStreams([{ units: [65, 13], unicode: false }])
  const fib = new DataView(streams.WordDocument!.buffer)
  fib.setUint32(154 + 11 * 8, 0xffffffff, true)
  fib.setUint32(158 + 11 * 8, 52, true)
  const bytes = compoundFixture(streams)
  const before = bytes.slice()
  const result = inspectDoc(bytes, { includeHeaderFooters: true, limits: { maxHeaderFooterStories: 1 } })
  expect(result.headerFooters!.positions).toEqual([])
  expect(result.headerFooters!.stories).toEqual([])
  expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'stale-header-directory' }))
  expect(bytes).toEqual(before)
  expect(inspectDoc(bytes).diagnostics.some(item => item.code === 'stale-header-directory')).toBe(false)
})

it('continues refusing a missing directory when source header text exists', () => {
  const streams = headerFooterStreams([['', 'Header\r\r', '', '', '', '']])
  new DataView(streams.WordDocument!.buffer).setUint32(158 + 11 * 8, 0, true)
  expect(() => inspectDoc(compoundFixture(streams), { includeHeaderFooters: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-story-data' }))
})
