import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { openCompoundFile } from '../../compound/reader'
import { readWordHeader } from '../fib'
import { readFontRecords } from './read'

/** @param name - Primary name. @param alternate - Optional alias. @param padding - Zero code units after the last name. @returns Independent FFN bytes. */
function font(name: string, alternate?: string, padding = 0): Uint8Array {
  const text = `${name}\0${alternate === undefined ? '' : `${alternate}\0`}${'\0'.repeat(padding)}`
  const bytes = new Uint8Array(39 + text.length * 2)
  const view = new DataView(bytes.buffer)
  bytes[0] = 0x26; view.setUint16(1, 400, true); bytes[3] = 134
  bytes[4] = alternate === undefined ? 0 : name.length + 1
  view.setUint32(15, 0x80000001, true)
  for (let i = 0; i < text.length; i++) view.setUint16(39 + i * 2, text.charCodeAt(i), true)
  return bytes
}

/** @param records - Independently encoded FFNs. @returns Complete non-extended STTB. */
function table(...records: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(4 + records.reduce((sum, value) => sum + 1 + value.length, 0))
  new DataView(bytes.buffer).setUint16(0, records.length, true)
  let position = 4
  for (const record of records) { bytes[position++] = record.length; bytes.set(record, position); position += record.length }
  return bytes
}

describe('source font table records', () => {
  it.each([undefined, '备用字体'])('retains only zero padding after a complete name and alias %s', alternate => {
    const bytes = font('Source Face', alternate, 3)
    expect(readFontRecords(table(bytes))[0]).toMatchObject({ name: 'Source Face', namePadding: 3,
      ...(alternate === undefined ? {} : { alternateName: alternate }) })
    bytes[bytes.length - 2] = 65
    expect(() => readFontRecords(table(bytes))).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })

  it('keeps empty primary names and unadvertised nonempty aliases outside padding compatibility', () => {
    expect(() => readFontRecords(table(font('', 'Calibri')))).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
    const bytes = font('Source Face', 'Hidden Alias')
    bytes[4] = 0
    expect(() => readFontRecords(table(bytes))).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })
  it('retains primary/alternate names and each substitution descriptor without choosing a font', () => {
    const result = readFontRecords(table(font('DengXian', '等线'), font('Latin Face')))
    expect(result[0]).toEqual({ name: 'DengXian', alternateName: '等线', pitch: 2, family: 2, trueType: true,
      weight: 400, charset: 134, panose: Array(10).fill(0), signature: [0x80000001, 0, 0, 0, 0, 0] })
    expect(result[1]?.name).toBe('Latin Face')
    expect(result[1]).not.toHaveProperty('alternateName')
  })

  it.each(['count', 'extra', 'size', 'terminator', 'alias', 'pitch', 'family', 'weight', 'charset', 'tail'] as const)
    ('rejects an invalid %s without substituting a default family', kind => {
      let bytes = table(font('A', '甲'))
      const view = new DataView(bytes.buffer)
      if (kind === 'count') view.setUint16(0, 0xffff, true)
      if (kind === 'extra') view.setUint16(2, 1, true)
      if (kind === 'size') bytes[4] = 255
      if (kind === 'terminator') bytes[bytes.length - 2] = 65
      if (kind === 'alias') bytes[9] = 1
      if (kind === 'pitch') bytes[5] = 3
      if (kind === 'family') bytes[5] = 0x60
      if (kind === 'weight') view.setUint16(6, 1001, true)
      if (kind === 'charset') bytes[8] = 42
      if (kind === 'tail') bytes = Uint8Array.from([...bytes, 0])
      expect(() => readFontRecords(bytes)).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
    })

  it('reads the native Word fixture names independently recorded in its font table', () => {
    const bytes = readFileSync(new URL('../../testing/fixtures/word-mac/chinese-basic.doc', import.meta.url))
    const limits = resolveLimits({})
    const container = openCompoundFile(bytes, limits)
    const header = readWordHeader(container.readRootStream('WordDocument')!, limits)
    const source = container.readRootStream(header.tableStream)!
    const range = header.records[15]!
    const result = readFontRecords(source.subarray(range.offset, range.offset + range.length))
    expect(result.map(value => value.name)).toEqual(['Times New Roman', 'Symbol', 'Arial', 'DengXian', '等线 Light', 'Cambria Math'])
    expect(result[3]?.alternateName).toBe('等线')
  })
})
