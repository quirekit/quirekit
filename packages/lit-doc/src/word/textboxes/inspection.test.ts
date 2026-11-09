import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { textboxStreams } from '../../testing/textboxes/streams'
import type { TextboxEntryVector } from '../../testing/textboxes/types'

const first: TextboxEntryVector = { start: 0, end: 3, data: [1, 0], reuseFlags: 0, destination: 0xffffffff, shapeId: 1026, undoTextId: 0 }
const final: TextboxEntryVector = { start: 3, end: 0x7fffffff, data: [0xffffffff, 0], reuseFlags: 0, destination: 0, shapeId: 0, undoTextId: 99 }

/** @returns Independent body/header textbox source including middle spare slots and original fragment sentinels. */
function fixture() {
  return textboxStreams('A\r\r\r', '\rH\r\r\r', [
    { kind: 'textbox', entries: [first, final], breaks: [
      { start: 0, end: 3, textboxIndex: 0, dependency: -2, flags: 0x1801 },
      { start: 3, end: 6, textboxIndex: 0xffff, dependency: 0, flags: 0 },
    ] },
    { kind: 'headerTextbox', entries: [
      { ...final, start: 0, end: 1, reuseFlags: 0x8001 },
      { ...first, start: 1, end: 4, shapeId: 2050 }, { ...final, start: 4 },
    ] },
  ])
}

it('retains complete independent textbox records, forced terminal spare roles and original local coordinates', () => {
  const input = compoundFixture(fixture()), before = input.slice()
  const result = inspectDoc(input, { includeTextboxes: true })
  expect(result.textboxes?.scope).toBe('textbox-source')
  expect(result.textboxes?.parts).toHaveLength(2)
  expect(result.textboxes!.parts[0]).toEqual({ kind: 'textbox', textTerminalCp: 0x7fffffff, breakTerminalCp: 6,
    entries: [{ ...first, index: 0, reusable: false }, { ...final, index: 1, reusable: true }], breaks: [
      { index: 0, start: 0, end: 3, textboxIndex: 0, dependency: -2, flags: 0x1801 },
      { index: 1, start: 3, end: 6, textboxIndex: 0xffff, dependency: 0, flags: 0 },
    ] })
  expect(result.textboxes!.parts[1]!.entries.map(entry => [entry.index, entry.start, entry.end, entry.reusable, entry.reuseFlags]))
    .toEqual([[0, 0, 1, true, 0x8001], [1, 1, 4, false, 0], [2, 4, 0x7fffffff, true, 0]])
  expect(result.textboxes!.parts[1]!.breakTerminalCp).toBeNull()
  expect(input).toEqual(before); expect(inspectDoc(input).textboxes).toBeUndefined()
  expect(result.diagnostics.some(item => item.code === 'textbox-formatting-unresolved')).toBe(true)
})

it('distinguishes missing and physically empty source PLCs without allocating editor content', () => {
  const absent = inspectDoc(compoundFixture(textboxStreams('', '', [])), { includeTextboxes: true }).textboxes!
  expect(absent.parts.map(part => [part.entries, part.breaks, part.textTerminalCp, part.breakTerminalCp]))
    .toEqual([[[], [], null, null], [[], [], null, null]])
  const empty = inspectDoc(compoundFixture(textboxStreams('', '', [{ kind: 'textbox', entries: [] }])), { includeTextboxes: true }).textboxes!
  expect(empty.parts[0]!.textTerminalCp).toBe(0)
})

it('charges both parts and both PLC kinds to shared allocation and work budgets', () => {
  const input = compoundFixture(fixture())
  for (const limits of [{ maxTextboxEntries: 6 }, { maxPropertyOperations: 6 }])
    expect(() => inspectDoc(input, { includeTextboxes: true, includeDrawings: true, limits })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('refuses malformed physical extents, missing indexes and invalid author-content ranges', () => {
  const malformed = fixture()
  new DataView(malformed.WordDocument!.buffer).setUint32(158 + 56 * 8, 5, true)
  expect(() => inspectDoc(compoundFixture(malformed), { includeTextboxes: true })).toThrow(expect.objectContaining({ code: 'invalid-story-data' }))
  expect(() => inspectDoc(compoundFixture(textboxStreams('A\r\r\r', '', [])), { includeTextboxes: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-story-data' }))
  const bad = textboxStreams('ABCD\r', '', [{ kind: 'textbox', entries: [{ ...first, end: 4 }, { ...final, start: 4 }] }])
  expect(() => inspectDoc(compoundFixture(bad), { includeTextboxes: true })).toThrow(expect.objectContaining({ code: 'invalid-story-data' }))
})

it('validates source options and the hard raw-record allocation limit', () => {
  const input = compoundFixture(fixture())
  expect(() => inspectDoc(input, { includeTextboxes: 1 as unknown as boolean })).toThrow(expect.objectContaining({ code: 'invalid-input' }))
  expect(() => inspectDoc(input, { limits: { maxTextboxEntries: 100001 } })).toThrow(expect.objectContaining({ code: 'invalid-input' }))
})
