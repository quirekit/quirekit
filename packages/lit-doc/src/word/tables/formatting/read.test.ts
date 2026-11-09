import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../../../binary/limits'
import { tableDefinition } from '../../../testing/tables/definition'
import { createPropertyReader } from '../../properties/reader'
import { readRowFormat } from './read'

/** @param opcode - Normative operation. @param bytes - Exact bounded operand. @returns Encoded operation. */
function op(opcode: number, ...bytes: number[]) { return [opcode & 255, opcode >>> 8, ...bytes] }

/** @param groups - Complete raw operations. @returns Canonical direct row tuple. */
function row(...groups: number[][]) {
  const reader = createPropertyReader(undefined, resolveLimits({}))
  return readRowFormat(reader.read(Uint8Array.from(groups.flat())), reader)
}

describe('DOC source row geometry and merge values', () => {
  it.each([[0, 'none'], [1, 'continue'], [2, 'restart'], [3, 'restart']] as const)
  ('decodes horizontal code %i independently of legacy Boolean accessor names', (flags, horizontal) => {
    expect(row(tableDefinition([0, 1440], [{ flags, width: 0 }])).cells[0]?.horizontal).toBe(horizontal)
  })

  it.each([[0, 'none'], [1, 'continue'], [3, 'restart']] as const)('decodes vertical code %i', (flags, vertical) => {
    expect(row(tableDefinition([0, 1440], [{ flags: flags << 5, width: 0 }])).cells[0]?.vertical).toBe(vertical)
  })

  it('rejects the reserved vertical role without calling it an independent restart', () => {
    expect(() => row(tableDefinition([0, 1440], [{ flags: 2 << 5, width: 0 }])))
      .toThrow(expect.objectContaining({ code: 'invalid-table-data' }))
  })

  it('retains percentage preference independently of the physical cell width', () => {
    const value = row(tableDefinition([-120, 1320], [{ flags: 2 << 9, width: 2500 }]))
    expect(value.edges).toEqual([-120, 1320])
    expect(value.cells[0]?.width).toEqual({ type: 'pct', value: 2500 })
  })

  it('builds an inserted row and applies subsequent range widths in source order', () => {
    const value = row(op(0x7621, 0, 3, 104, 1), op(0x7623, 0, 1, 232, 3), op(0x7623, 1, 3, 220, 5))
    expect(value.edges).toEqual([0, 1000, 2500, 4000])
    expect(value.cells).toHaveLength(3)
    expect(value.cells.map(cell => cell.width)).toEqual([null, null, null])
  })

  it('preserves surviving source edge positions when deleting definitions', () => {
    const value = row(tableDefinition([0, 1000, 2500, 4000]), op(0x5622, 1, 2))
    expect(value.edges).toEqual([0, 2500, 4000])
    expect(value.cells).toHaveLength(2)
  })

  it('inserts in the middle without overwriting either neighboring width or preferred settings', () => {
    const value = row(tableDefinition([-120, 880, 2380], [{ flags: 3 << 9, width: 900 }, { flags: 2 << 9, width: 2500 }]),
      op(0x7621, 1, 2, 250, 0))
    expect(value.edges).toEqual([-120, 880, 1130, 1380, 2880])
    expect(value.cells.map(cell => cell.width)).toEqual([{ type: 'dxa', value: 900 }, null, null, { type: 'pct', value: 2500 }])
  })

  it('lets a later definition replace previous cell formatting without applying a table style as structure', () => {
    const value = row(tableDefinition([0, 1000], [{ flags: 3 << 5, width: 0 }]), op(0x563a, 11, 0),
      tableDefinition([0, 500, 1500]))
    expect(value.edges).toEqual([0, 500, 1500])
    expect(value.cells.map(cell => [cell.horizontal, cell.vertical])).toEqual([['none', 'none'], ['none', 'none']])
    expect(value.unsupportedOpcodes).toContain(0x563a)
  })

  it('defaults omitted TC80 entries and ignores descriptors beyond the declared physical cell count', () => {
    expect(row(tableDefinition([0, 1000, 2000], [{ flags: 2, width: 0 }])).cells.map(cell => cell.horizontal)).toEqual(['restart', 'none'])
    expect(row(tableDefinition([0, 1000], [{ flags: 0, width: 0 }, { flags: 2 << 5, width: 0 }])).cells).toHaveLength(1)
  })

  it('keeps modern cantSplit authoritative regardless of the obsolete operation ordering', () => {
    for (const operations of [[op(0x3466, 0), op(0x3403, 1)], [op(0x3403, 1), op(0x3466, 0)]])
      expect(row(tableDefinition([0, 1000]), ...operations).cantSplit).toBe(false)
  })

  it('preserves full cell direction, alignment and explicit false bits from their original tuple', () => {
    const value = row(tableDefinition([0, 1000], [{ flags: 5 << 2 | 2 << 7 | 0x1000 | 0x4000, width: 0 }])).cells[0]!
    expect(value).toMatchObject({ textDirection: 'tbRlV', verticalAlign: 'bottom', fitText: true, noWrap: false, hideMark: true })
    expect([...value.fields]).toContain('noWrap')
  })

  it('applies merge/split and explicit vertical range updates after a definition', () => {
    const value = row(tableDefinition([0, 1000, 2000, 3000]), op(0x5624, 0, 3), op(0x5625, 2, 3), op(0xd62b, 2, 1, 3))
    expect(value.cells.map(cell => [cell.horizontal, cell.vertical])).toEqual([['restart', 'none'], ['continue', 'restart'], ['none', 'none']])
  })

  it('keeps explicit zero/false row settings and signed exact-height semantics', () => {
    const value = row(tableDefinition([0, 1440]), op(0x3403, 1), op(0x3466, 0), op(0x3404, 0), op(0x9407, 0xd0, 0xfe))
    expect(value).toMatchObject({ cantSplit: false, header: false, height: { value: 304, rule: 'exact' } })
    expect(row(tableDefinition([0, 1440]), op(0x9407, 0, 0)).height).toEqual({ value: 0, rule: 'auto' })
  })

  it('keeps an explicit source origin offset separate from actual cell margins', () => {
    const value = row(tableDefinition([0, 1440]), op(0x9601, 0xe8, 3), op(0x9602, 0x6c, 0))
    expect(value.edges).toEqual([892, 2332])
    expect(value.gapHalf).toBe(108)
  })

  it.each([op(0x7623, 0, 2, 10, 0), op(0xd62b, 2, 1, 1), op(0xd62c, 3, 0, 1, 3), op(0x3466, 2)].map(operation => ({ operation })))
  ('refuses malformed range or scalar operations instead of inventing source geometry: $operation', ({ operation }) => {
    expect(() => row(tableDefinition([0, 1440]), operation)).toThrow(expect.objectContaining({ code: 'invalid-table-data' }))
  })
})
