import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { noteStreams } from '../../testing/notes'

it('inspects both note families in absolute source coordinates while ignoring undefined PLC endpoints', () => {
  const input = compoundFixture(noteStreams('A\u0002B\u0002\r', [{ anchor: 1, text: '\u0002 Foot\r', referenceValue: 7 }], [{ anchor: 3, text: '\u0002 End\r' }]))
  const before = input.slice()
  const actual = inspectDoc(input, { includeNotes: true })
  expect(actual.notes).toEqual({ scope: 'note-source', entries: [
    { kind: 'footnote', index: 0, anchor: 1, start: 5, end: 12, referenceValue: 7, autoNumbered: true },
    { kind: 'endnote', index: 0, anchor: 3, start: 13, end: 19, referenceValue: 1, autoNumbered: true },
  ] })
  expect(input).toEqual(before)
  expect(inspectDoc(input).notes).toBeUndefined()
  expect(() => inspectDoc(input, { includeNotes: true, limits: { maxNotes: 1 } })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('retains a custom-mark source selector separately from automatic note numbering', () => {
  const actual = inspectDoc(compoundFixture(noteStreams('*\r', [{ anchor: 0, text: '* Note\r', referenceValue: 0 }])), { includeNotes: true })
  expect(actual.notes!.entries[0]).toMatchObject({ referenceValue: 0, autoNumbered: false, anchor: 0 })
})

it('accepts empty reference PLCs containing only an undefined final position', () => {
  const streams = noteStreams('Text\r')
  const header = new DataView(streams.WordDocument!.buffer)
  header.setUint32(154 + 2 * 8, 0xffffffff, true)
  header.setUint32(158 + 2 * 8, 4, true)
  expect(inspectDoc(compoundFixture(streams), { includeNotes: true }).notes).toEqual({ scope: 'note-source', entries: [] })
})

it.each([
  { name: 'duplicate references', field: 2, at: 4, value: 1 },
  { name: 'out-of-range reference', field: 2, at: 0, value: 5 },
  { name: 'wrong automatic anchor', field: 2, at: 0, value: 0 },
  { name: 'duplicate content range', field: 3, at: 4, value: 0 },
  { name: 'out-of-range content end', field: 3, at: 8, value: 1000 },
  { name: 'missing paragraph ending', field: 3, at: 4, value: 2 },
])('refuses $name without changing the caller buffer', ({ field, at, value }) => {
  const streams = noteStreams('A\u0002B\u0002\r', [{ anchor: 1, text: '\u0002 A\r' }, { anchor: 3, text: '\u0002 B\r' }])
  const offset = new DataView(streams.WordDocument!.buffer).getUint32(154 + field * 8, true)
  new DataView(streams['1Table']!.buffer).setUint32(offset + at, value, true)
  const input = compoundFixture(streams)
  const before = input.slice()
  expect(() => inspectDoc(input, { includeNotes: true })).toThrow(expect.objectContaining({ code: 'invalid-story-data' }))
  expect(input).toEqual(before)
})

it('refuses cross-family duplicate anchors and malformed counted directories before allocation', () => {
  const duplicate = compoundFixture(noteStreams('\u0002\r', [{ anchor: 0, text: '\u0002 A\r' }], [{ anchor: 0, text: '\u0002 B\r' }]))
  expect(() => inspectDoc(duplicate, { includeNotes: true })).toThrow(expect.objectContaining({ code: 'invalid-story-data' }))
  const streams = noteStreams('\u0002\r', [{ anchor: 0, text: '\u0002 A\r' }])
  new DataView(streams.WordDocument!.buffer).setUint32(158 + 2 * 8, 9, true)
  expect(() => inspectDoc(compoundFixture(streams), { includeNotes: true })).toThrow(expect.objectContaining({ code: 'invalid-story-data' }))
})

it('validates explicit note options and their hard allocation limit', () => {
  const input = compoundFixture(noteStreams('A\r'))
  expect(() => inspectDoc(input, { includeNotes: 1 as unknown as boolean })).toThrow(expect.objectContaining({ code: 'invalid-input' }))
  expect(() => inspectDoc(input, { limits: { maxNotes: 100001 } })).toThrow(expect.objectContaining({ code: 'invalid-input' }))
})
