import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'

describe('main-story paragraph boundaries', () => {
  it('keeps empty paragraphs and cell/row boundaries within shared formatting', () => {
    const streams = withParagraphRecords(wordStreams([{ units: [88, 13, 13, 89, 7, 7, 13], unicode: false }]), [
      { cuts: [2048, 2055] },
    ])
    const bytes = compoundFixture(streams)
    expect(inspectDoc(bytes).paragraphs).toBeUndefined()
    expect(inspectDoc(bytes, { includeParagraphs: true }).paragraphs).toEqual([
      { start: 0, end: 2, ending: 'paragraph' }, { start: 2, end: 3, ending: 'paragraph' },
      { start: 3, end: 5, ending: 'cell-or-row' }, { start: 5, end: 6, ending: 'cell-or-row' },
      { start: 6, end: 7, ending: 'paragraph' },
    ])
  })

  it('keeps manual line/page breaks inside a paragraph while recognizing section endings', () => {
    const streams = withParagraphRecords(wordStreams([{ units: [65, 12, 66, 11, 67, 13, 68, 12, 69, 13], unicode: false }]), [
      { cuts: [2048, 2054, 2056, 2058] },
    ], [8, 10])
    expect(inspectDoc(compoundFixture(streams), { includeParagraphs: true }).paragraphs).toEqual([
      { start: 0, end: 6, ending: 'paragraph' }, { start: 6, end: 8, ending: 'section' },
      { start: 8, end: 10, ending: 'paragraph' },
    ])
  })

  it('follows logical pieces across physical reversal and excludes other stories', () => {
    const streams = withParagraphRecords(wordStreams([
      { units: [0x4e2d], unicode: true }, { units: [65, 13], unicode: false },
      { units: [72, 13, 13], unicode: false },
    ], { reversePhysical: true, storyLengths: [3, 0, 2, 0, 0, 0, 0] }), [
      { cuts: [2048, 2055] },
    ], [5])
    expect(inspectDoc(compoundFixture(streams), { includeParagraphs: true }).paragraphs).toEqual([
      { start: 0, end: 3, ending: 'paragraph' },
    ])
  })

  it('requires evidence instead of silently falling back when paragraph records are missing', () => {
    const bytes = compoundFixture(wordStreams([{ units: [65, 13], unicode: false }]))
    expect(inspectDoc(bytes).text).toBe('A\r')
    expect(() => inspectDoc(bytes, { includeParagraphs: true })).toThrow(expect.objectContaining({ code: 'invalid-paragraph-data' }))
  })

  it('rejects invalid section endpoints, incomplete main paragraphs and exhausted budgets', () => {
    const source = wordStreams([{ units: [65, 13, 66, 13], unicode: false }])
    const valid = withParagraphRecords(source, [{ cuts: [2048, 2052] }])
    expect(() => inspectDoc(compoundFixture(valid), { includeParagraphs: true, limits: { maxParagraphs: 1 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    expect(() => inspectDoc(compoundFixture(withParagraphRecords(source, [{ cuts: [2048, 2052] }], [2, 4])), { includeParagraphs: true }))
      .toThrow(/section/i)
    const broken = withParagraphRecords(wordStreams([{ units: [65, 13, 66], unicode: false }]), [{ cuts: [2048, 2051] }])
    expect(() => inspectDoc(compoundFixture(broken), { includeParagraphs: true })).toThrow(/main.*paragraph/i)
  })

  it.each(['duplicate', 'short-coverage', 'bad-length', 'wrong-start'] as const)('rejects section table %s', (kind) => {
    const streams = withParagraphRecords(wordStreams([{ units: [65, 12, 66, 13], unicode: false }]), [{ cuts: [2048, 2052] }], [2, 4])
    const word = new DataView(streams.WordDocument!.buffer)
    const table = new DataView(streams['1Table']!.buffer)
    const offset = word.getUint32(154 + 6 * 8, true)
    if (kind === 'duplicate') table.setUint32(offset + 8, 2, true)
    if (kind === 'short-coverage') table.setUint32(offset + 8, 3, true)
    if (kind === 'bad-length') word.setUint32(158 + 6 * 8, 35, true)
    if (kind === 'wrong-start') table.setUint32(offset, 1, true)
    expect(() => inspectDoc(compoundFixture(streams), { includeParagraphs: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-paragraph-data' }))
  })

  it('treats form feeds as inline breaks when no section table declares an ending', () => {
    const streams = withParagraphRecords(wordStreams([{ units: [65, 12, 66, 13], unicode: false }]), [{ cuts: [2048, 2052] }])
    new DataView(streams.WordDocument!.buffer).setUint32(158 + 6 * 8, 0, true)
    const result = inspectDoc(compoundFixture(streams), { includeParagraphs: true })
    expect(result.paragraphs).toEqual([{ start: 0, end: 4, ending: 'paragraph' }])
    expect(result.diagnostics.map(item => item.code)).toContain('paragraph-formatting-unresolved')
  })
})
