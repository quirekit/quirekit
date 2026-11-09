import { expect, it } from 'vitest'
import { inspectDoc } from '../../../inspection'
import { compoundFixture } from '../../../testing/compound'
import { operation } from '../../../testing/formatting'
import { noteSettingsStreams } from '../../../testing/notes/settings'

/** @returns Independent Word 97 document settings with nondefault note fields. */
function legacySettings(): Uint8Array {
  const bytes = new Uint8Array(500)
  const view = new DataView(bytes.buffer)
  view.setUint8(0, 2 << 5)
  view.setUint16(2, (7 << 2) | 1, true)
  view.setUint16(52, (9 << 2) | 2, true)
  view.setUint16(54, 3, true)
  view.setUint16(492, 3, true)
  view.setUint16(494, 1, true)
  return bytes
}

it.each([0xc1, 0xd9])('inspects legacy document numbering at effective version %i', version => {
  const input = compoundFixture(noteSettingsStreams(version, [[]], legacySettings()))
  const before = input.slice()
  expect(inspectDoc(input, { includeNoteSettings: true }).noteSettings).toMatchObject({
    scope: 'note-settings-source',
    document: { endnotePosition: 3, legacyNumbering: {
      footnote: { format: 3, restart: 1, start: 7, position: 2 },
      endnote: { format: 1, restart: 2, start: 9 },
    } },
    sections: [{ start: 0, end: 2,
      footnote: { format: 0, restart: 0, offset: 0, position: 1, explicit: [] },
      endnote: { format: 2, restart: 0, offset: 0, explicit: [] },
    }],
  })
  expect(inspectDoc(input).noteSettings).toBeUndefined()
  expect(input).toEqual(before)
})

it('keeps ordered section overrides, explicit zero and independent section defaults', () => {
  const operations = [...operation(0x5040, 1, 0), ...operation(0x5040, 4, 0), ...operation(0x303c, 2),
    ...operation(0x503f, 0, 0), ...operation(0x303b, 2), ...operation(0x303e, 1),
    ...operation(0x5041, 255, 63), ...operation(0x5042, 3, 0)]
  const actual = inspectDoc(compoundFixture(noteSettingsStreams(0x101, [operations, []], legacySettings())), { includeNoteSettings: true }).noteSettings!
  expect(actual.document).toEqual({ endnotePosition: 3 })
  expect(actual.sections).toEqual([
    { start: 0, end: 2,
      footnote: { format: 4, restart: 2, offset: 0, position: 2, explicit: ['format', 'restart', 'offset', 'position'] },
      endnote: { format: 3, restart: 1, offset: 16383, explicit: ['restart', 'offset', 'format'] } },
    { start: 2, end: 4,
      footnote: { format: 0, restart: 0, offset: 0, position: 1, explicit: [] },
      endnote: { format: 2, restart: 0, offset: 0, explicit: [] } },
  ])
})

it.each([0x101, 0x10c, 0x112])('ignores legacy numbering bits for effective version %i', version => {
  const settings = new Uint8Array(56).fill(255)
  expect(inspectDoc(compoundFixture(noteSettingsStreams(version, [[]], settings)), { includeNoteSettings: true }).noteSettings!.document)
    .toEqual({ endnotePosition: 3 })
})

it('retains missing document settings without manufacturing source values', () => {
  expect(inspectDoc(compoundFixture(noteSettingsStreams(0xc1)), { includeNoteSettings: true }).noteSettings!.document).toBeNull()
})

it('retains explicit true and false section-end suppression independently of numbering', () => {
  const input = compoundFixture(noteSettingsStreams(0x101, [operation(0x3012, 0), operation(0x3012, 1)]))
  expect(inspectDoc(input, { includeNoteSettings: true }).noteSettings!.sections.map(section => section.suppressEndnotes)).toEqual([true, false])
  const malformed = compoundFixture(noteSettingsStreams(0x101, [operation(0x3012, 2)]))
  expect(() => inspectDoc(malformed, { includeNoteSettings: true })).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it.each([
  operation(0x303b, 0), operation(0x303b, 3), operation(0x303c, 3), operation(0x303e, 2),
  operation(0x503f, 0, 64), operation(0x5041, 0, 64), operation(0x2403, 1), [0x40, 0x50, 1],
].map(operations => ({ operations })))('refuses malformed section note settings $operations', ({ operations }) => {
  const input = compoundFixture(noteSettingsStreams(0x101, [operations]))
  expect(() => inspectDoc(input, { includeNoteSettings: true })).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  expect(() => inspectDoc(input, { includeNotes: true })).not.toThrow()
})

it.each([0, 1, 55, 493, 495])('rejects a truncated active legacy DOP of %i bytes', length => {
  const settings = legacySettings().slice(0, length)
  const input = compoundFixture(noteSettingsStreams(0xc1, [[]], settings))
  if (length === 0) expect(inspectDoc(input, { includeNoteSettings: true }).noteSettings!.document).toBeNull()
  else expect(() => inspectDoc(input, { includeNoteSettings: true })).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it('validates document enum values and shares the operation budget', () => {
  const settings = legacySettings()
  settings[54] = 1
  expect(() => inspectDoc(compoundFixture(noteSettingsStreams(0x101, [[]], settings)), { includeNoteSettings: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  settings[54] = 3
  settings[2] = 3
  expect(() => inspectDoc(compoundFixture(noteSettingsStreams(0xc1, [[]], settings)), { includeNoteSettings: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  const input = compoundFixture(noteSettingsStreams(0x101, [operation(0x5040, 4, 0)]))
  expect(() => inspectDoc(input, { includeNoteSettings: true, limits: { maxPropertyOperations: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  expect(() => inspectDoc(input, { includeNoteSettings: 1 as unknown as boolean }))
    .toThrow(expect.objectContaining({ code: 'invalid-input' }))
})
