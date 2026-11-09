import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { DocReadError } from '../../errors'
import { readNumberingRecords } from './records'

import { numberingRecordsFixture as fixture } from '../../testing/numbering'

describe('independent Word numbering record boundaries', () => {
  it('reads appended levels beyond lcbPlfLst and keeps the original bytes unchanged', () => {
    const { table, header } = fixture()
    const before = table.slice()
    const result = readNumberingRecords(table, header, resolveLimits({}))
    expect(result).toMatchObject({ definitions: [{ sourceId: 101, templateCode: 7, simple: true,
      levels: [{ index: 0, rawStartAt: 1, startAt: 1, numberFormat: 0, alignment: 0,
        suffix: 0, template: '\u0000.', placeholderOffsets: [1] }] }],
    instances: [{ index: 1, sourceId: 101, definitionIndex: 0, firstParagraphCp: null, overrides: [] }] })
    expect(table).toEqual(before)
    result.definitions[0]!.levels[0]!.headerBytes[0] = 99
    expect(table).toEqual(before)
    expect(readNumberingRecords(table, header, resolveLimits({})).definitions[0]?.levels[0]?.startAt).toBe(1)
  })

  it('keeps a sparse zero start override on its actual level', () => {
    const { table, header } = fixture({ multi: true, overrideLevel: 5, overrideStart: 0 })
    const result = readNumberingRecords(table, header, resolveLimits({}))
    expect(result.definitions[0]!.levels).toHaveLength(9)
    expect(result.instances[0]!.overrides).toMatchObject([{ level: 5, startOverride: 0, formatting: null }])
  })

  it('keeps bullet text separate from level placeholders and ignores its inactive start value', () => {
    const { table, header } = fixture({ format: 0x17, template: '\u2022', placeholder: 0, start: -1 })
    expect(readNumberingRecords(table, header, resolveLimits({})).definitions[0]!.levels[0])
      .toMatchObject({ rawStartAt: -1, startAt: null, numberFormat: 0x17, template: '\u2022', placeholderOffsets: [] })
  })

  it('rejects a missing definition and an out-of-range template placeholder', () => {
    for (const options of [{ linkedId: 202 }, { placeholder: 3 }]) {
      const { table, header } = fixture(options)
      expect(() => readNumberingRecords(table, header, resolveLimits({}))).toThrow(DocReadError)
    }
  })

  it('rejects truncated levels and instance data rather than accepting partial records', () => {
    const { table, header } = fixture()
    for (const size of [1, 29, 35, table.length - 1]) {
      expect(() => readNumberingRecords(table.subarray(0, size), header, resolveLimits({}))).toThrow(DocReadError)
    }
  })

  it('treats both absent locators as empty independently of their ignored offsets', () => {
    const { header } = fixture()
    const records = header.records.map((range, index) => index === 73 || index === 74 ? { offset: 0xffffffff, length: 0 } : range)
    expect(readNumberingRecords(new Uint8Array(), { ...header, records }, resolveLimits({})))
      .toMatchObject({ definitions: [], instances: [] })
  })

  it('shares level and text budgets and validates definition/instance counts before allocation', () => {
    const multi = fixture({ multi: true })
    for (const limits of [{ maxNumberingLevels: 8 }, { maxNumberingTextCodeUnits: 17 }]) {
      expect(() => readNumberingRecords(multi.table, multi.header, resolveLimits({ limits })))
        .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    }
    const source = fixture()
    const definitions = source.table.slice()
    new DataView(definitions.buffer).setUint16(0, 2, true)
    expect(() => readNumberingRecords(definitions, source.header, resolveLimits({ limits: { maxNumberingDefinitions: 1 } })))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    const instances = source.table.slice()
    new DataView(instances.buffer).setUint32(source.header.records[74]!.offset, 2, true)
    expect(() => readNumberingRecords(instances, source.header, resolveLimits({ limits: { maxNumberingInstances: 1 } })))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it('uses a full replacement start when both override flags are set, ignoring the inactive outer value', () => {
    const source = fixture({ multi: true, overrideLevel: 5, overrideStart: -1 })
    const table = new Uint8Array(source.table.length + 34)
    table.set(source.table); table.set(source.table.subarray(30, 64), source.table.length)
    const view = new DataView(table.buffer)
    view.setUint32(source.header.records[74]!.offset + 28, 5 | 0x30, true)
    view.setInt32(source.table.length, 0, true)
    const records = source.header.records.map((range, index) => index === 74 ? { ...range, length: range.length + 34 } : range)
    expect(readNumberingRecords(table, { ...source.header, records }, resolveLimits({})).instances[0]?.overrides[0])
      .toMatchObject({ level: 5, rawStartAt: -1, startOverride: null, formatting: { index: 5, startAt: 0 } })
    expect(() => readNumberingRecords(table, { ...source.header, records }, resolveLimits({ limits: { maxNumberingLevels: 9 } })))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it('rejects semantic header values and opaque property truncation without interpreting their contents', () => {
    for (const [offset, value] of [[34, 8], [35, 3], [45, 3], [55, 255]]) {
      const { table, header } = fixture()
      table[offset!] = value!
      expect(() => readNumberingRecords(table, header, resolveLimits({})))
        .toThrow(expect.objectContaining({ code: 'invalid-numbering-data' }))
    }
    const { table, header } = fixture()
    new DataView(table.buffer).setInt32(2, -1, true)
    expect(() => readNumberingRecords(table, header, resolveLimits({})))
      .toThrow(expect.objectContaining({ code: 'invalid-numbering-data' }))
  })

  it('does not enforce ignored restart, indentation, placeholder-tail or non-sequence start fields', () => {
    const { table, header } = fixture({ format: 255, start: -1, placeholder: 0, template: '' })
    const view = new DataView(table.buffer)
    table[37] = 255
    table[56] = 255
    view.setInt32(46, -2147483648, true)
    expect(readNumberingRecords(table, header, resolveLimits({})).definitions[0]?.levels[0])
      .toMatchObject({ startAt: null, savedIndentTwips: null, restartLimit: null, placeholderOffsets: [] })
  })

  it('rejects repeated source identities before associating any instance', () => {
    const source = fixture()
    const table = new Uint8Array(source.table.length + 62)
    table.set(source.table.subarray(0, 30)); table.set(source.table.subarray(2, 30), 30)
    table.set(source.table.subarray(30, 64), 58); table.set(source.table.subarray(30, 64), 92)
    table.set(source.table.subarray(64), 126)
    new DataView(table.buffer).setUint16(0, 2, true)
    const records = source.header.records.map((range, index) => index === 73 ? { offset: 0, length: 58 }
      : index === 74 ? { offset: 126, length: 24 } : range)
    expect(() => readNumberingRecords(table, { ...source.header, records }, resolveLimits({})))
      .toThrow(expect.objectContaining({ code: 'invalid-numbering-data', message: 'Invalid or duplicate numbering identity' }))
  })

  it('rejects overlapping regions, trailing instance bytes and ambiguous repeated level overrides', () => {
    const source = fixture({ multi: true, overrideLevel: 5 })
    const table = new Uint8Array(source.table.length + 8)
    table.set(source.table)
    const instanceAt = source.header.records[74]!.offset
    const records = source.header.records.map((range, index) => index === 74 ? { ...range, length: range.length + 8 } : range)
    expect(() => readNumberingRecords(table, { ...source.header, records }, resolveLimits({})))
      .toThrow(expect.objectContaining({ code: 'invalid-numbering-data' }))
    table[instanceAt + 16] = 2
    table.set(source.table.subarray(instanceAt + 24, instanceAt + 32), source.table.length)
    expect(() => readNumberingRecords(table, { ...source.header, records }, resolveLimits({})))
      .toThrow(expect.objectContaining({ code: 'unsupported-numbering' }))
    const overlapping = source.header.records.map((range, index) => index === 74 ? { offset: 30, length: 24 } : range)
    expect(() => readNumberingRecords(source.table, { ...source.header, records: overlapping }, resolveLimits({})))
      .toThrow(expect.objectContaining({ code: 'invalid-numbering-data', message: 'Numbering definitions and instances overlap' }))
  })
})
