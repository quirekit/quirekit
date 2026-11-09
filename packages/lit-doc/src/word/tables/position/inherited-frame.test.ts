import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../../../inspection'
import { compoundFixture } from '../../../testing/compound'
import { operation } from '../../../testing/formatting'
import { withParagraphRecords } from '../../../testing/paragraphs'
import { tableDefinition } from '../../../testing/tables/definition'
import { wordStreams } from '../../../testing/word'

/** @param opcode - Source scalar operation. @param value - Exact encoded word. @returns Independent wire property. */
function word(opcode: number, value: number): number[] { return operation(opcode, value & 255, value >>> 8 & 255) }
const frame = [...word(0x8418, 11), ...word(0x8419, 21), ...operation(0x261b, 0x90), ...operation(0x2423, 2)]
const placed = [...operation(0x360d, 0x90), ...word(0x940e, 11), ...word(0x940f, 21)]
const outer = [...operation(0x2416, 1), ...operation(0x6649, 1, 0, 0, 0)]
const innerMember = [...operation(0x2416, 1), ...operation(0x6649, 2, 0, 0, 0)]
const inner = [...innerMember, ...operation(0x244b, 1)]

/**
 * Encodes complete nested rows before their outer TTP authority, without using reader output.
 * @param owners - Each real outer row with its own paragraph frame and nested rows.
 * @param position - Independent outer TTP position, or no position.
 * @param nestedPosition - Optional independent inner TTP position.
 * @returns Complete CFB with physically separate cell and row endings.
 */
function fixture(owners: readonly { frame: readonly number[], inner: readonly (readonly number[])[], first?: readonly number[], prefix?: readonly number[] }[],
  position: readonly number[] = placed, nestedPosition: readonly number[] = []): Uint8Array {
  const paragraphs = owners.flatMap(owner => [
    { text: 'A\r', properties: [...outer, ...(owner.first ?? owner.frame)] },
    ...owner.inner.flatMap(properties => [...(owner.prefix === undefined ? [] : [{ text: 'X\r', properties: [...innerMember, ...owner.prefix] }]),
      { text: 'B\r', properties: [...inner, ...properties] },
      { text: '\r', properties: [...inner, ...operation(0x244c, 1), ...tableDefinition([0, 1440]), ...nestedPosition] }]),
    { text: 'C\u0007', properties: [...outer, ...owner.frame] },
    { text: '\u0007', properties: [...outer, ...operation(0x2417, 1), ...tableDefinition([0, 2880]), ...position] },
  ])
  paragraphs.push({ text: '\r', properties: [] }); let byte = 2048
  const pages = paragraphs.map(paragraph => {
    const start = byte; byte += paragraph.text.length
    return { cuts: [start, byte], records: [{ bytes: paragraph.properties, odd: paragraph.properties.length % 2 === 1 }] }
  })
  const units = paragraphs.flatMap(paragraph => Array.from(paragraph.text, character => character.charCodeAt(0)))
  return compoundFixture(withParagraphRecords(wordStreams([{ units, unicode: false }]), pages))
}

describe('nested duplicate frame ownership', () => {
  it('keeps the nested table in its cell when the complete outer authority appears later', () => {
    const source = inspectDoc(fixture([{ frame, inner: [frame, frame] }]), { includeTables: true })
    expect(source.tables).toHaveLength(2)
    expect(source.tables![0]!.identity.position).toMatchObject({ horizontalAnchor: 'page', verticalAnchor: 'page', horizontal: { offset: 10 }, vertical: { offset: 20 } })
    expect(source.tables![1]!.identity.position).toBeUndefined()
    expect(source.tables![1]!.parent).toEqual({ tableIndex: 0, rowIndex: 0, cellIndex: 0 })
    expect(source.tables![1]!.rows).toHaveLength(2)
    expect(source.diagnostics.filter(value => value.code === 'redundant-nested-table-frame')).toHaveLength(1)
  })
  it('takes the actual enclosing row as authority rather than another row in the same positioned table', () => {
    const other = [...frame, ...word(0x8418, 12)]
    expect(() => inspectDoc(fixture([{ frame, inner: [other] }, { frame: other, inner: [other] }]), { includeTables: true }))
      .toThrow(/Paragraph-frame table positioning/)
    const accepted = inspectDoc(fixture([{ frame, inner: [frame] }, { frame: other, inner: [other] }]), { includeTables: true })
    expect(accepted.tables).toHaveLength(3)
    expect(accepted.tables!.slice(1).map(table => table.parent?.rowIndex)).toEqual([0, 1])
    expect(accepted.diagnostics.filter(value => value.code === 'redundant-nested-table-frame')).toHaveLength(2)
  })
  it.each([
    { owner: [], children: [frame], position: placed },
    { owner: frame, children: [frame], position: [] },
    { owner: frame, children: [[...frame, ...word(0x8418, 12)]], position: placed },
    { owner: frame, children: [frame, []], position: placed },
    { owner: [...frame, ...word(0x842f, 100)], children: [frame], position: placed },
  ])('retains refusal when source ownership is not proved: %j', ({ owner, children, position }) => {
    expect(() => inspectDoc(fixture([{ frame: owner, inner: children }], position), { includeTables: true }))
      .toThrow(/Paragraph-frame table positioning/)
  })
  it('keeps independent nested placement ahead of its paragraph frame', () => {
    const source = inspectDoc(fixture([{ frame: [], inner: [frame] }], placed, placed), { includeTables: true })
    expect(source.tables![1]!.identity.position).toEqual(source.tables![0]!.identity.position)
    expect(source.diagnostics.some(value => value.code === 'redundant-nested-table-frame')).toBe(false)
  })
  it('does not borrow a later cell paragraph or marker as the first paragraph frame', () => {
    for (const value of [{ frame, first: [], inner: [frame] }, { frame, prefix: [], inner: [frame] }])
      expect(() => inspectDoc(fixture([value]), { includeTables: true })).toThrow(/Paragraph-frame table positioning/)
  })
  it('preserves the original ordinary nested flow and validates source limits', () => {
    const bytes = fixture([{ frame: [], inner: [[]] }], [])
    expect(inspectDoc(bytes, { includeTables: true }).tables!.map(table => table.identity.position)).toEqual([undefined, undefined])
    for (const limits of [{ maxTables: 1 }, { maxTableDepth: 1 }])
      expect(() => inspectDoc(fixture([{ frame, inner: [frame] }]), { includeTables: true, limits })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })
  it('compares final scalar writes rather than operation order or superseded values', () => {
    const source = inspectDoc(fixture([{ frame: [...word(0x8418, 2), ...frame], inner: [frame] }]), { includeTables: true })
    expect(source.tables).toHaveLength(2)
  })
})
