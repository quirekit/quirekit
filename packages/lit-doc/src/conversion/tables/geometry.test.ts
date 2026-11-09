import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { tableDefinition } from '../../testing/tables/definition'
import { createPropertyReader } from '../../word/properties/reader'
import { readRowFormat } from '../../word/tables/formatting'
import { unifyTableGeometry } from './geometry'

/** @param groups - Source operations for every row. @returns Common grid compiled from independently encoded rows. */
function compile(...groups: number[][]) {
  const reader = createPropertyReader(undefined, resolveLimits({}))
  return unifyTableGeometry(groups.map(bytes => readRowFormat(reader.read(Uint8Array.from(bytes)), reader)), reader)
}

describe('common DOC table grid and merge ownership', () => {
  it('derives spans from all row boundaries rather than from the first row cell count', () => {
    const value = compile(tableDefinition([0, 1000, 3000]), tableDefinition([0, 1000, 2000, 3000]))
    expect(value.grid).toEqual([1000, 1000, 1000])
    expect(value.rows.map(row => row.spans)).toEqual([[1, 2], [1, 1, 1]])
  })

  it('keeps both leading and trailing omitted columns in the same page coordinate space', () => {
    const value = compile(tableDefinition([1000, 2000]), tableDefinition([0, 1000, 2000, 3000]))
    expect(value).toMatchObject({ origin: 0, end: 3000, grid: [1000, 1000, 1000] })
    expect(value.rows.map(row => [row.before, row.after])).toEqual([[1, 1], [0, 0]])
  })

  it('validates the exact adjacent vertical interval while retaining every explicit continuation', () => {
    const value = compile(tableDefinition([0, 2000], [{ flags: 3 << 5, width: 0 }]),
      tableDefinition([0, 2000], [{ flags: 1 << 5, width: 0 }]), tableDefinition([0, 2000]))
    expect(value.rows.map(row => row.source.cells[0]?.vertical)).toEqual(['restart', 'continue', 'none'])
  })

  it('does not reconnect a vertical chain across an ordinary row', () => {
    expect(() => compile(tableDefinition([0, 2000], [{ flags: 3 << 5, width: 0 }]), tableDefinition([0, 2000]),
      tableDefinition([0, 2000], [{ flags: 1 << 5, width: 0 }]))).toThrow(expect.objectContaining({ code: 'invalid-table-data' }))
  })

  it('rejects shifted vertical continuation and an orphan horizontal continuation', () => {
    expect(() => compile(tableDefinition([0, 2000], [{ flags: 3 << 5, width: 0 }]),
      tableDefinition([0, 1000], [{ flags: 1 << 5, width: 0 }]))).toThrow(expect.objectContaining({ code: 'invalid-table-data' }))
    expect(() => compile(tableDefinition([0, 1000], [{ flags: 1, width: 0 }]))).toThrow(expect.objectContaining({ code: 'invalid-table-data' }))
  })

  it('recognizes a contiguous header prefix and keeps an ignored later flag observable in the source tuple', () => {
    const rows = [1, 1, 0, 1].map(value => [...tableDefinition([0, 1000]), 4, 0x34, value])
    const value = compile(...rows)
    expect(value.rows.map(row => row.header)).toEqual([true, true, false, false])
    expect(value.rows[3]?.source.header).toBe(true)
  })

  it('refuses zero-width source cells before creating any table grid', () => {
    expect(() => compile(tableDefinition([0, 0, 1000]))).toThrow(expect.objectContaining({ code: 'unsupported-table' }))
  })
})
