import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { withCharacterRecords } from '../../testing/characters'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'

/**
 * Encodes one paragraph whose ordinary characters and ending have explicit run properties.
 * @param operations - Raw direct operations on the ordinary text.
 * @returns Source streams before optional stylesheet replacement.
 */
function source(operations: readonly number[]): Record<string, Uint8Array> {
  return withCharacterRecords(withParagraphRecords(wordStreams([{ units: [65, 66, 13], unicode: false }]), [
    { cuts: [2048, 2051] },
  ]), [{ cuts: [2048, 2050, 2051], records: [operations, undefined] }])
}

describe('character base formatting', () => {
  it('partitions at source records and applies four-state toggles against the style snapshot', () => {
    const streams = withStyleDefinitions(source([...op(0x0835, 0), ...op(0x0835, 0x81)]), [
      { index: 0, characters: op(0x0835, 1) },
    ])
    const result = inspectDoc(compoundFixture(streams), { includeCharacterFormatting: true })
    expect(result.characterRuns?.map(run => [run.start, run.end, run.baseFormat.bold])).toEqual([[0, 2, false], [2, 3, true]])
    expect(result.characterRuns?.[0]?.baseFormat).toMatchObject({ scope: 'character-base', fontSizeHalfPoints: 20 })
  })

  it('resets direct formatting when applying a character style and preserves highlight across clear', () => {
    const operations = [...op(0x0835, 0), ...op(0x4a30, 15, 0), ...op(0x2a0c, 7), ...op(0x2a33, 0)]
    const streams = withStyleDefinitions(source(operations), [
      { index: 0, characters: op(0x0835, 1) }, { index: 15, kind: 2, characters: op(0x0836, 1) },
    ])
    expect(inspectDoc(compoundFixture(streams), { includeCharacterFormatting: true }).characterRuns?.[0]?.baseFormat)
      .toMatchObject({ bold: true, italic: false, characterStyleIndex: 10, highlight: 7 })
  })

  it('keeps character storage optional and rejects an incomplete UTF-16 range when requested', () => {
    const streams = withStyleDefinitions(withCharacterRecords(withParagraphRecords(wordStreams([{ units: [65, 13], unicode: true }]), [
      { cuts: [2048, 2052] },
    ]), [{ cuts: [2048, 2049, 2052] }]), [{ index: 0 }])
    const bytes = compoundFixture(streams)
    expect(inspectDoc(bytes, { includeParagraphFormatting: true }).paragraphs).toHaveLength(1)
    expect(() => inspectDoc(bytes, { includeCharacterFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })

  it('retains source units, font slots, languages and the last color representation', () => {
    const operations = [...op(0x4a43, 34, 0), ...op(0x4a61, 36, 0), ...op(0x4a4f, 2, 0), ...op(0x2a42, 6),
      ...op(0x6870, 0x33, 0x66, 0x99, 0), ...op(0x4873, 9, 4), ...op(0x8840, 0xec, 0xff),
      ...op(0x4845, 0xfc, 0xff), ...op(0x2a3e, 43), ...op(0x4852, 80, 0)]
    const streams = withStyleDefinitions(source(operations), [{ index: 0 }])
    expect(inspectDoc(compoundFixture(streams), { includeCharacterFormatting: true }).characterRuns?.[0]?.baseFormat)
      .toMatchObject({ fontSizeHalfPoints: 34, fontSizeComplexHalfPoints: 36, fontIndexes: { ascii: 2, complex: null },
        color: { encoding: 'colorref', value: 0x996633 }, language: 0x409, spacingTwips: -20,
        positionHalfPoints: -4, underline: 43, scalePercent: 80 })
  })

  it('uses four independent default font slots and preserves the explicitly automatic complex size', () => {
    const streams = withStyleDefinitions(source([]), [{ index: 0 }], false, [3, 4, 5, 6])
    expect(inspectDoc(compoundFixture(streams), { includeCharacterFormatting: true }).characterRuns?.[0]?.baseFormat)
      .toMatchObject({ fontIndexes: { ascii: 3, eastAsia: 4, other: 5, complex: 6 }, fontSizeComplexHalfPoints: null,
        rightToLeft: null, complexScript: null })
  })

  it('applies ending-piece groups after CHPX while keeping paragraph operations out of the character layer', () => {
    let streams = withStyleDefinitions(source(op(0x0835, 1)), [{ index: 0 }])
    streams = withPiecePropertyGroup(streams, [...op(0x2405, 1), ...op(0x0835, 0)], 0)
    const result = inspectDoc(compoundFixture(streams), { includeCharacterFormatting: true })
    expect(result.paragraphs?.[0]?.baseFormat?.keepLines).toBe(true)
    expect(result.characterRuns?.map(run => run.baseFormat.bold)).toEqual([false, false])
  })

  it('preserves explicit direction across clear while restoring paragraph language and size', () => {
    const operations = [...op(0x085a, 1), ...op(0x4873, 4, 8), ...op(0x4a43, 40, 0), ...op(0x2a33, 0)]
    const streams = withStyleDefinitions(source(operations), [{ index: 0, characters: [...op(0x4873, 9, 4), ...op(0x4a43, 24, 0)] }])
    expect(inspectDoc(compoundFixture(streams), { includeCharacterFormatting: true }).characterRuns?.[0]?.baseFormat)
      .toMatchObject({ rightToLeft: true, language: 0x409, fontSizeHalfPoints: 24 })
  })

  it('applies a character style reset at its source position and uses its inherited toggle basis', () => {
    const streams = withStyleDefinitions(source([...op(0x0835, 0), ...op(0x4a30, 15, 0), ...op(0x0836, 0x81)]), [
      { index: 0, characters: op(0x0835, 1) }, { index: 15, kind: 2, parent: 16, characters: op(0x0836, 0) },
      { index: 16, kind: 2, characters: op(0x0836, 1) },
    ])
    expect(inspectDoc(compoundFixture(streams), { includeCharacterFormatting: true }).characterRuns?.[0]?.baseFormat)
      .toMatchObject({ bold: true, italic: true, characterStyleIndex: 15 })
  })

  it.each([0x4a30, 0x2a33])('keeps the CHPX script hint across binary reset %i without leaking it to the next run', reset => {
    const operation = reset === 0x4a30 ? op(reset, 15, 0) : op(reset, 0)
    const streams = withStyleDefinitions(source([...op(0x286f, 2), ...op(0x4a43, 40, 0), ...operation]), [
      { index: 0 }, { index: 15, kind: 2, characters: op(0x0836, 1) },
    ])
    const result = inspectDoc(compoundFixture(streams), { includeCharacterFormatting: true })
    expect(result.characterRuns?.map(run => [run.start, run.end, run.baseFormat.scriptHint, run.baseFormat.fontSizeHalfPoints]))
      .toEqual([[0, 2, 2, 20], [2, 3, 0, 20]])
  })

  it.each([op(0x0835, 2), op(0x4a43, 1, 0), op(0x2a3e, 5), op(0x4852, 0, 0),
    op(0x6870, 0, 0, 0, 1), op(0x2a33, 1)].map(operations => ({ operations })))('rejects invalid scalar or toggle values: %j', ({ operations }) => {
    const streams = withStyleDefinitions(source(operations), [{ index: 0 }])
    expect(() => inspectDoc(compoundFixture(streams), { includeCharacterFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })

  it.each([op(0x2a32, 0), op(0xca31, 7, 0, 15, 0, 15, 0, 16, 0), op(0x0882, 0x81)]
    .map(operations => ({ operations })))('rejects an unimplemented compound change or unresolved inversion: %j', ({ operations }) => {
    const streams = withStyleDefinitions(source(operations), [{ index: 0 }])
    expect(() => inspectDoc(compoundFixture(streams), { includeCharacterFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'unsupported-formatting' }))
  })

  it('bounds logical character runs and combined paragraph/character index allocation', () => {
    const bytes = compoundFixture(withStyleDefinitions(source([]), [{ index: 0 }]))
    expect(() => inspectDoc(bytes, { includeCharacterFormatting: true, limits: { maxCharacterRuns: 1 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    expect(inspectDoc(bytes, { includeParagraphFormatting: true, limits: { maxFormattingPages: 1 } }).paragraphs).toHaveLength(1)
    expect(() => inspectDoc(bytes, { includeCharacterFormatting: true, limits: { maxFormattingPages: 1 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it('rejects a character-style cycle and illegal style operations without affecting paragraph mode', () => {
    const bytes = compoundFixture(withStyleDefinitions(source(op(0x4a30, 15, 0)), [
      { index: 0 }, { index: 15, kind: 2, parent: 16 }, { index: 16, kind: 2, parent: 15 },
    ]))
    expect(() => inspectDoc(bytes, { includeCharacterFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
    const invalid = compoundFixture(withStyleDefinitions(source([]), [{ index: 0, characters: op(0x085a, 1) }]))
    expect(inspectDoc(invalid, { includeParagraphFormatting: true }).paragraphs).toHaveLength(1)
    expect(() => inspectDoc(invalid, { includeCharacterFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })
})
