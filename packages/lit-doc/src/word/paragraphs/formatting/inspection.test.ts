import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../../../inspection'
import { compoundFixture } from '../../../testing/compound'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from '../../../testing/formatting'
import { withParagraphRecords } from '../../../testing/paragraphs'
import { wordStreams } from '../../../testing/word'

/**
 * Builds a paragraph with independently chosen source style and direct operations.
 * @param direct - Ordered PAPX operations.
 * @returns Synthetic source streams before adding the stylesheet.
 */
function source(direct: number[] = []): Record<string, Uint8Array> {
  return withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
    cuts: [2048, 2050], records: [{ style: 15, bytes: direct, odd: direct.length % 2 === 1 }],
  }])
}

describe('paragraph base formatting inspection', () => {
  it('applies parent, child and direct values without losing explicit false or zero', () => {
    const streams = withStyleDefinitions(source([...op(0x2405, 0), ...op(0xa414, 0, 0)]), [
      { index: 0, properties: [...op(0x2405, 1), ...op(0x2406, 1), ...op(0xa414, 240, 0)] },
      { index: 15, parent: 0, properties: op(0x2406, 0) },
    ])
    const result = inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true })
    expect(result.paragraphs?.[0]?.baseFormat).toMatchObject({ scope: 'paragraph-base', styleIndex: 15,
      keepLines: false, keepNext: false, pageBreakBefore: false, widowControl: true,
      spacingBeforeTwips: 0, spacingAfterTwips: 0, lineSpacing: { value: 240, multiple: true } })
  })

  it('retains physical and logical directions, negative first-line indent and exact spacing', () => {
    const direct = [...op(0x2403, 2), ...op(0x845e, 0xd0, 2), ...op(0x840e, 0x68, 1),
      ...op(0x8460, 0x98, 0xfe), ...op(0x6412, 0x20, 0xfe, 0, 0)]
    const streams = withStyleDefinitions(source(direct), [{ index: 0 }, { index: 15, parent: 0 }], true)
    expect(inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true }).paragraphs?.[0]?.baseFormat)
      .toMatchObject({ alignment: { value: 2, logical: false }, leftIndent: { twips: 720, logical: true },
        rightIndent: { twips: 360, logical: false }, firstLineIndentTwips: -360, lineSpacing: { value: -480, multiple: false } })
  })

  it('keeps format inspection optional and rejects a cyclic style graph only when requested', () => {
    const bytes = compoundFixture(withStyleDefinitions(source(), [{ index: 0, parent: 15 }, { index: 15, parent: 0 }]))
    expect(inspectDoc(bytes, { includeParagraphs: true }).paragraphs).toHaveLength(1)
    expect(() => inspectDoc(bytes, { includeParagraphFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })

  it('applies the ending piece short modifier after PAPX and inherited properties', () => {
    const streams = withStyleDefinitions(source(op(0x2405, 1)), [{ index: 0 }, { index: 15, parent: 0 }])
    new DataView(streams['1Table']!.buffer).setUint16(5 + 2 * 4 + 6, 0x07 * 2, true)
    expect(inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true }).paragraphs?.[0]?.baseFormat?.keepLines).toBe(false)
  })

  it('diagnoses unsupported ordinary fields and keeps physical basis separate from paragraph direction', () => {
    const streams = withStyleDefinitions(source([...op(0x2403, 0), ...op(0x2441, 1), ...op(0x245b, 1)]), [
      { index: 0 }, { index: 15, parent: 0 },
    ])
    const result = inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true })
    expect(result.paragraphs?.[0]?.baseFormat).toMatchObject({ alignment: { value: 0, logical: false },
      bidi: true, unsupportedOpcodes: [0x245b] })
    expect(result.diagnostics.map(value => value.code)).toContain('paragraph-formatting-partial')
  })

  it.each([op(0xc601, 0), op(0x2602, 1), op(0x4610, 1, 0), op(0x465f, 1, 0)].map(bytes => [bytes]))('rejects unsupported compound changes %j', (bytes) => {
    const streams = withStyleDefinitions(source(bytes), [{ index: 0 }, { index: 15, parent: 0 }])
    expect(() => inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'unsupported-formatting' }))
  })

  it.each([op(0x2405, 2), op(0x2461, 10), op(0x840e, 0, 0x80), op(0xa413, 0xc1, 0x7b),
    op(0x6412, 240, 0, 2, 0), [5]].map(bytes => [bytes]))('rejects invalid values or truncated operations %j', (bytes) => {
    const streams = withStyleDefinitions(source(bytes), [{ index: 0 }, { index: 15, parent: 0 }])
    expect(() => inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })

  it.each(['empty', 'missing', 'wrong-kind'] as const)('rejects a %s inherited style', kind => {
    const definitions = [{ index: 15, parent: kind === 'missing' ? 30 : 0 },
      ...(kind === 'empty' || kind === 'missing' ? [] : [{ index: 0, kind: 2 }])]
    expect(() => inspectDoc(compoundFixture(withStyleDefinitions(source(), definitions)), { includeParagraphFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })

  it('bounds both inheritance depth and total property applications', () => {
    const bytes = compoundFixture(withStyleDefinitions(source(op(0x2405, 0)), [
      { index: 0, properties: op(0x2405, 1) }, { index: 15, parent: 0 },
    ]))
    expect(() => inspectDoc(bytes, { includeParagraphFormatting: true, limits: { maxFormattingDepth: 1 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    expect(() => inspectDoc(bytes, { includeParagraphFormatting: true, limits: { maxPropertyOperations: 3 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it('takes a complex modifier from the ending piece and filters character operations', () => {
    let streams = withParagraphRecords(wordStreams([
      { units: [65], unicode: true }, { units: [13], unicode: false },
    ], { reversePhysical: true }), [{ cuts: [2048, 2051], records: [{ bytes: op(0x2405, 1), odd: true }] }])
    streams = withStyleDefinitions(streams, [{ index: 0 }])
    streams = withPiecePropertyGroup(streams, [...op(0x0835, 1), ...op(0x2405, 0)], 1)
    expect(inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true }).paragraphs?.[0]?.baseFormat)
      .toMatchObject({ keepLines: false, unsupportedOpcodes: [] })
  })

  it('keeps cached styles and sibling paragraph settings independent', () => {
    const streams = withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13, 66, 13], unicode: false }]), [{
      cuts: [2048, 2050, 2052], records: [{ bytes: op(0x2405, 0), odd: true }, {}],
    }]), [{ index: 0, properties: op(0x2405, 1) }])
    const formats = inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true }).paragraphs!.map(value => value.baseFormat!)
    expect(formats.map(value => value.keepLines)).toEqual([false, true])
    formats[0]!.leftIndent.twips = 500
    expect(formats[1]!.leftIndent.twips).toBe(0)
  })

  it('retains a style-only PAPX instead of replacing it with the document default', () => {
    const streams = withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13, 66, 13], unicode: false }]), [{
      cuts: [2048, 2050, 2052], records: [{ style: 15 }, { style: 0 }],
    }]), [{ index: 0 }, { index: 15, parent: 0, properties: op(0x2406, 1) }])
    const formats = inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true }).paragraphs!.map(value => value.baseFormat!)
    expect(formats.map(value => [value.styleIndex, value.keepNext])).toEqual([[15, true], [0, false]])
  })

  it('checks the owning style index and diagnoses a short unused stylesheet extent', () => {
    const streams = withStyleDefinitions(source(), [{ index: 0 }, { index: 15, parent: 0 }])
    const word = new DataView(streams.WordDocument!.buffer)
    const table = new DataView(streams['1Table']!.buffer)
    const offset = word.getUint32(154 + 8, true)
    table.setUint16(offset + 20 + 2 + 18, 15, true)
    expect(() => inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
    table.setUint16(offset + 20 + 2 + 18, 0, true)
    word.setUint32(158 + 8, word.getUint32(158 + 8, true) - 3, true)
    expect(inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true }).diagnostics)
      .toContainEqual(expect.objectContaining({ code: 'extended-stylesheet-range' }))
  })

  it('reads indirect PAPX settings from Data and validates the top-level style restriction', () => {
    const properties = [...op(0x2405, 1), ...op(0x2406, 0), ...op(0x6412, 0xe0, 1, 1, 0)]
    const data = new Uint8Array(properties.length + 2)
    new DataView(data.buffer).setUint16(0, properties.length, true)
    data.set(properties, 2)
    const direct = op(0x6646, 0, 0, 0, 0)
    const streams = withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
      cuts: [2048, 2050], records: [{ style: 0, bytes: direct }],
    }]), [{ index: 0 }])
    streams.Data = data
    expect(inspectDoc(compoundFixture(streams), { includeParagraphFormatting: true }).paragraphs?.[0]?.baseFormat)
      .toMatchObject({ keepLines: true, lineSpacing: { value: 480, multiple: true } })
    expect(() => inspectDoc(compoundFixture(withStyleDefinitions(source(direct), [{ index: 0 }, { index: 15, parent: 0 }])),
      { includeParagraphFormatting: true })).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })
})
