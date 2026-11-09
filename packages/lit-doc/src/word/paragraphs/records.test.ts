import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'
import { readWordHeader } from '../fib'
import { readTextStorage } from '../pieces'
import { readParagraphPage } from './page'
import { readParagraphRecords } from './read'

describe('paragraph source property records', () => {
  it('reads even/odd property envelopes and the distinct zero-pointer default', () => {
    const streams = withParagraphRecords(wordStreams([{ units: [65, 13, 13, 13], unicode: false }]), [{
      cuts: [2048, 2050, 2051, 2052], records: [
        { style: 7, bytes: [0x07, 0x24, 1, 0x08, 0x24, 0] },
        { style: 3, bytes: [0x03, 0x24, 2], odd: true }, { absent: true },
      ],
    }])
    const records = readParagraphPage(streams.WordDocument!.subarray(4096, 4608))
    expect(records.map((record) => record.styleIndex)).toEqual([7, 3, 0])
    expect(Array.from(records[1]!.properties)).toEqual([0x03, 0x24, 2])
    expect(records[2]!.properties.length).toBe(0)
  })

  it('associates a cross-piece paragraph with its ending piece and preserves unresolved modifiers', () => {
    const streams = withParagraphRecords(wordStreams([
      { units: [0x4e2d], unicode: true }, { units: [65, 13], unicode: false },
    ], { reversePhysical: true }), [{ cuts: [2048, 2050, 2052], records: [{ style: 7 }, { style: 3 }] }])
    new DataView(streams['1Table']!.buffer).setUint16(5 + 3 * 4 + 8 + 6, 0x42, true)
    const limits = resolveLimits({})
    const header = readWordHeader(streams.WordDocument!, limits)
    const storage = readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits)
    const records = readParagraphRecords(streams.WordDocument!, streams['1Table']!, header, storage, limits)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ pieceIndex: 1, propertyModifier: 0x42, endsFormattingRecord: true,
      formatting: { styleIndex: 7 } })
  })

  it('ignores reserved page-number high bits and bounds index allocation', () => {
    const streams = withParagraphRecords(wordStreams([{ units: [65, 13, 13], unicode: false }]), [
      { cuts: [2048, 2050] }, { cuts: [2050, 2051] },
    ])
    const locator = new DataView(streams.WordDocument!.buffer).getUint32(154 + 13 * 8, true)
    const view = new DataView(streams['1Table']!.buffer)
    view.setUint32(locator + 12, view.getUint32(locator + 12, true) | 0xffc00000, true)
    expect(inspectDoc(compoundFixture(streams), { includeParagraphs: true }).paragraphs).toHaveLength(2)
    expect(() => inspectDoc(compoundFixture(streams), { includeParagraphs: true, limits: { maxFormattingPages: 1 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it.each(['count', 'ordering', 'metadata', 'envelope', 'empty-length'] as const)('rejects malformed page %s', (kind) => {
    const streams = withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{ cuts: [2048, 2050] }])
    const page = streams.WordDocument!.slice(4096, 4608)
    const view = new DataView(page.buffer)
    if (kind === 'count') page[511] = 30
    if (kind === 'ordering') view.setUint32(4, 2048, true)
    if (kind === 'metadata') page[8] = 2
    if (kind === 'envelope') page[400] = 255
    if (kind === 'empty-length') page[401] = 0
    expect(() => readParagraphPage(page)).toThrow(expect.objectContaining({ code: 'invalid-paragraph-data' }))
  })

  it('rejects a formatting interval that cuts through a UTF-16 code unit', () => {
    const streams = withParagraphRecords(wordStreams([{ units: [65, 13], unicode: true }]), [{ cuts: [2048, 2051] }])
    expect(() => inspectDoc(compoundFixture(streams), { includeParagraphs: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-paragraph-data' }))
  })

  it.each(['truncated-index', 'out-of-stream-page', 'missing-coverage'] as const)('rejects %s without changing default storage inspection', (kind) => {
    const streams = withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{ cuts: [2048, 2050] }])
    const word = new DataView(streams.WordDocument!.buffer)
    const table = new DataView(streams['1Table']!.buffer)
    const offset = word.getUint32(154 + 13 * 8, true)
    if (kind === 'truncated-index') word.setUint32(154 + 13 * 8, streams['1Table']!.length - 2, true)
    if (kind === 'out-of-stream-page') table.setUint32(offset + 8, 0x3fffff, true)
    if (kind === 'missing-coverage') table.setUint32(offset + 4, 2049, true)
    const bytes = compoundFixture(streams)
    expect(inspectDoc(bytes).text).toBe('A\r')
    expect(() => inspectDoc(bytes, { includeParagraphs: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-paragraph-data' }))
  })
})
