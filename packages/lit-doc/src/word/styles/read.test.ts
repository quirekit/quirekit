import { expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { operation, withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { compoundFixture } from '../../testing/compound'
import { inspectDoc } from '../../inspection'
import { wordStreams } from '../../testing/word'
import { readWordHeader } from '../fib'
import { readWordStyles } from './read'

/** @returns Source style records with a complete final definition beyond a shortened FIB extent. */
function fixture() {
  const streams = withStyleDefinitions(wordStreams([{ units: [65, 13], unicode: false }]),
    [{ index: 0 }, { index: 15, parent: 0, characters: [0x35, 0x08, 1] }])
  const header = readWordHeader(streams.WordDocument!, resolveLimits({}))
  return { table: streams['1Table']!, header }
}

it('recovers complete counted styles beyond a short declaration and reports the compatibility decision', () => {
  const { table, header } = fixture()
  const records = header.records.map(record => ({ ...record }))
  records[1]!.length -= 4
  const result = readWordStyles(table, { ...header, records })
  expect(result.styles).toHaveLength(16)
  expect([...result.styles[15]!.character]).toEqual([0x35, 0x08, 1])
  expect(result.diagnostics.map(item => item.code)).toEqual(['extended-stylesheet-range'])
  expect(readWordStyles(table, header).diagnostics).toEqual([])
})

it('refuses recovery across another located region or beyond the physical stream', () => {
  const { table, header } = fixture()
  const records = header.records.map(record => ({ ...record }))
  records[1]!.length -= 4
  records[2] = { offset: records[1]!.offset + records[1]!.length, length: 4 }
  expect(() => readWordStyles(table, { ...header, records }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  records[2] = { offset: 0, length: 0 }
  expect(() => readWordStyles(table.subarray(0, table.length - 1), { ...header, records }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it('requires the declared extent to contain the complete stylesheet header', () => {
  const { table, header } = fixture()
  const records = header.records.map(record => ({ ...record }))
  records[1]!.length = 19
  expect(() => readWordStyles(table, { ...header, records }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it('retains lazy table-style diagnostics through inspection without duplicating the formatting pass', () => {
  const cell = [...operation(0x2416, 1), ...operation(0x6649, 1, 0, 0, 0)]
  const row = [...cell, ...operation(0x2417, 1), ...operation(0xd608, 6, 0, 1, 0, 0, 100, 0), ...operation(0x563a, 15, 0)]
  const streams = withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 7, 7, 13], unicode: false }]), [{
    cuts: [2048, 2050, 2051, 2052], records: [{ bytes: cell, odd: true }, { bytes: row, odd: row.length % 2 === 1 }, {}],
  }]), [{ index: 0 }, { index: 15, parent: 0 }])
  const view = new DataView(streams.WordDocument!.buffer)
  view.setUint32(166, view.getUint32(166, true) - 4, true)
  for (const includeParagraphFormatting of [false, true]) {
    const result = inspectDoc(compoundFixture(streams), { includeTables: true, includeParagraphFormatting })
    expect(result.tables).toHaveLength(1)
    expect(result.diagnostics.filter(item => item.code === 'extended-stylesheet-range')).toHaveLength(1)
  }
})
