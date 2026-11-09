import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { withCharacterRecords } from '../../testing/characters'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'
import { readDocumentSource } from '../document/read'
import { readParagraphRecords } from '../paragraphs/read'
import { readCharacterSources } from './source'

/** @param unicode - Independent one/two-byte source encoding. @param covered - Author characters covered by the original CHPX page/index. @returns Original streams with a complete PAPX and a separately bounded character layer. */
function original(unicode: boolean, covered = 2): Record<string, Uint8Array> {
  const width = unicode ? 2 : 1
  return withStyleDefinitions(withCharacterRecords(withParagraphRecords(wordStreams([{ units: [65, 66, 13], unicode }]), [
    { cuts: [2048, 2048 + 3 * width] },
  ]), [{ cuts: [2048, 2048 + covered * width], records: [[...op(0x0835, 1), ...op(0x4a43, 40, 0)]] }]), [
    { index: 0, characters: [...op(0x0836, 1), ...op(0x4a43, 24, 0)] },
  ])
}

it.each([false, true])('uses the paragraph style for the lone absent terminal CR, without extending preceding direct attributes, unicode=%s', unicode => {
  const result = inspectDoc(compoundFixture(original(unicode)), { includeCharacterFormatting: true })
  expect(result.characterRuns?.map(run => [run.start, run.end, run.baseFormat.bold, run.baseFormat.italic, run.baseFormat.fontSizeHalfPoints]))
    .toEqual([[0, 2, true, true, 40], [2, 3, false, true, 24]])
  expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'terminal-character-format-absent' }))
  expect(() => inspectDoc(compoundFixture(original(unicode)), { includeCharacterFormatting: true, limits: { maxCharacterRuns: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  const covered = inspectDoc(compoundFixture(original(unicode, 3)), { includeCharacterFormatting: true })
  expect(covered.characterRuns?.map(run => run.baseFormat.bold)).toEqual([true])
  expect(covered.diagnostics.some(item => item.code === 'terminal-character-format-absent')).toBe(false)
})

it.each([false, true])('keeps ordinary missing text, physical endpoint conflicts and nonzero piece modifiers rejected, unicode=%s', unicode => {
  expect(() => inspectDoc(compoundFixture(original(unicode, 1)), { includeCharacterFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  const streams = original(unicode), word = streams.WordDocument!.slice(), table = streams['1Table']!
  const fib = new DataView(word.buffer), index = fib.getUint32(154 + 12 * 8, true)
  const page = new DataView(table.buffer, table.byteOffset, table.byteLength).getUint32(index + 8, true) * 512
  fib.setUint32(page + 4, 2048 + 3 * (unicode ? 2 : 1), true)
  expect(() => inspectDoc(compoundFixture({ ...streams, WordDocument: word }), { includeCharacterFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  const modified = withPiecePropertyGroup(streams, op(0x0835, 0), 0)
  expect(() => inspectDoc(compoundFixture(modified), { includeCharacterFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it('does not apply a main-story terminal exception to another story range', () => {
  const source = readDocumentSource(compoundFixture(original(false)), {})
  const paragraphs = readParagraphRecords(source.word, source.table, source.header, source.storage, source.limits)
  const header = { ...source.header, stories: source.header.stories.map((story, index) => index === 0 ? { ...story, end: 2 } : story) }
  expect(() => readCharacterSources(source.word, source.table, header, source.storage, paragraphs, source.limits))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})
