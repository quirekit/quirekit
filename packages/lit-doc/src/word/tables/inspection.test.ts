import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { operation } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'

/** @param code - Normative opcode. @param bytes - Exact operand. @returns Encoded operation. */
function property(code: number, bytes: readonly number[]): number[] { return operation(code, ...bytes) }

/** @param count - Initial columns. @returns Independent minimal table definition. */
function definition(count: number): number[] {
  return property(0xd608, [4 + count * 2, 0, count, ...Array.from({ length: count + 1 }, (_, i) => [i * 100 & 255, i * 100 >> 8]).flat()])
}

/** @param level - Direct table depth. @param flags - Cell/row end operations. @returns Ordered properties. */
function membership(level: number, flags: readonly number[] = []): number[] {
  return [...property(0x2416, [1]), ...property(0x6649, [level, 0, 0, 0]), ...flags]
}

/** @param paragraphs - Independent source text/property tuples. @returns Complete synthetic DOC. */
function fixture(paragraphs: readonly (readonly [readonly number[], readonly number[]])[]): Uint8Array {
  let fc = 2048
  const pages = paragraphs.map(([units, bytes]) => {
    const start = fc; fc += units.length
    return { cuts: [start, fc], records: [{ bytes, odd: bytes.length % 2 === 1 }] }
  })
  return compoundFixture(withParagraphRecords(wordStreams([{ units: paragraphs.flatMap(([units]) => [...units]), unicode: false }]), pages))
}

const cell = membership(1)
const row = membership(1, [...property(0x2417, [1]), ...definition(1)])
const innerCell = membership(2, property(0x244b, [1]))
const innerRow = membership(2, [...property(0x244b, [1]), ...property(0x244c, [1]), ...definition(1)])

describe('main-story table topology', () => {
  it('keeps nested tables inside their owning cell and row marks outside content', () => {
    const bytes = fixture([[[65, 13], cell], [[66, 13], innerCell], [[13], innerRow], [[67, 7], cell], [[7], row], [[13], []]])
    const result = inspectDoc(bytes, { includeTables: true })
    expect(result.tables).toHaveLength(2)
    expect(result.tables?.[0]).toMatchObject({ level: 1, start: 0, end: 8, rows: [{ start: 0, end: 8,
      markerStart: 7, cells: [{ start: 0, end: 7, blocks: [{ kind: 'paragraph', index: 0 }, { kind: 'table', index: 1 }, { kind: 'paragraph', index: 3 }] }] }] })
    expect(result.tables?.[1]).toMatchObject({ level: 2, start: 2, end: 5, parent: { tableIndex: 0, rowIndex: 0, cellIndex: 0 } })
    expect(result.paragraphs).toHaveLength(6)
    expect(inspectDoc(bytes).tables).toBeUndefined()
  })

  it('includes an initial nested table in the parent cell before its first direct paragraph', () => {
    const result = inspectDoc(fixture([[[66, 13], innerCell], [[13], innerRow], [[67, 7], cell], [[7], row], [[13], []]]), { includeTables: true })
    expect(result.tables?.[0]).toMatchObject({ start: 0, end: 6, level: 1, rows: [{ cells: [{ start: 0, end: 5,
      blocks: [{ kind: 'table', index: 1 }, { kind: 'paragraph', index: 2 }] }] }] })
    expect(result.tables?.[1]).toMatchObject({ start: 0, end: 3, parent: { tableIndex: 0, rowIndex: 0, cellIndex: 0 } })
  })

  it('keeps a leading manual page break inside the first cell paragraph', () => {
    const result = inspectDoc(fixture([[[12, 65, 7], cell], [[7], row], [[13], []]]), { includeTables: true })
    expect(result.tables?.[0]?.rows[0]?.start).toBe(0)
    expect(result.tables?.[0]?.rows[0]?.cells[0]).toMatchObject({ start: 0, end: 3, blocks: [{ kind: 'paragraph', index: 0 }] })
  })

  it('distinguishes adjacent rows whose source table identity changes', () => {
    const result = inspectDoc(fixture([[[65, 7], cell], [[7], row], [[66, 7], cell],
      [[7], [...row, ...property(0x7469, [9, 0, 0, 0])]], [[13], []]]), { includeTables: true })
    expect(result.tables?.map(table => [table.start, table.end, table.rows.length])).toEqual([[0, 3, 1], [3, 6, 1]])
  })

  it('requires valid column definitions and rejects unfinished or inconsistent membership', () => {
    for (const paragraphs of [
      [[[65, 7], cell], [[7], membership(1, property(0x2417, [1]))], [[13], []]],
      [[[65, 13], cell], [[13], []]],
      [[[65, 7], membership(2)], [[13], []]],
      [[[65, 7], []], [[13], []]],
    ] as const) expect(() => inspectDoc(fixture(paragraphs), { includeTables: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-table-data' }))
  })

  it('refuses unresolved boundaries and unknown operations while storage inspection remains available', () => {
    for (const extra of [property(0x360d, [0x30]), property(0x8418, [0, 0]), property(0xd66a, [0]), property(0x568b, [0, 0])]) {
      const bytes = fixture([[[65, 7], cell], [[7], [...row, ...extra]], [[13], []]])
      expect(inspectDoc(bytes).text).toBe('A\u0007\u0007\r')
      expect(() => inspectDoc(bytes, { includeTables: true })).toThrow(expect.objectContaining({ code: 'unsupported-table' }))
    }
    const shared = compoundFixture(withParagraphRecords(wordStreams([{ units: [65, 7, 7, 13], unicode: false }]), [
      { cuts: [2048, 2051, 2052], records: [{ bytes: row, odd: row.length % 2 === 1 }, { absent: true }] },
    ]))
    expect(inspectDoc(shared, { includeTables: true }).tables?.map(table => table.rows.map(row => row.cells.length)))
      .toEqual([[1]])
  })

  it('applies depth deltas in source order and enforces explicit resource bounds', () => {
    const delta = [...membership(2), ...property(0x664a, [255, 255, 255, 255])]
    expect(inspectDoc(fixture([[[65, 7], delta], [[7], row], [[13], []]]), { includeTables: true }).tables?.[0]?.level).toBe(1)
    const nested = fixture([[[65, 13], cell], [[66, 13], innerCell], [[13], innerRow], [[7], cell], [[7], row], [[13], []]])
    expect(() => inspectDoc(nested, { includeTables: true, limits: { maxTableDepth: 1 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    expect(() => inspectDoc(nested, { includeTables: true, limits: { maxTables: 1 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })
})
