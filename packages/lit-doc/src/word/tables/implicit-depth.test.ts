import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { createDocxSourcePlan } from '../../conversion/plan'
import { operation as op } from '../../testing/formatting'
import { tableDocument } from '../../testing/tables/document'

/** @param properties - Exact additional row operations. @param version - Effective source generation. @returns Independent old table bytes. */
function source(properties: number[] = [], version = 0xc1): Uint8Array {
  return tableDocument([{ texts: ['甲', 'B'], edges: [0, 1440, 2880], cells: [{ flags: 0, width: 0 }, { flags: 0, width: 0 }], properties }],
    { version, implicitDepth: true })
}

describe('bounded legacy outer-table depth compatibility', () => {
  it.each([0xc1, 0xd9])('projects absent depth in generation %i and retains the input', version => {
    const bytes = source([], version), before = bytes.slice()
    const actual = inspectDoc(bytes, { includeTables: true })
    expect(actual.tables).toHaveLength(1)
    expect(actual.tables?.[0]).toMatchObject({ level: 1, rows: [{ cells: [{ start: 0, end: 2 }, { start: 2, end: 4 }] }] })
    expect(actual.diagnostics.filter(diagnostic => diagnostic.code === 'implicit-table-depth')).toHaveLength(1)
    expect(bytes).toEqual(before)
  })

  it.each([0x101, 0x10c, 0x112])('keeps generation %i outside this compatibility claim', version => {
    expect(() => inspectDoc(source([], version), { includeTables: true }))
      .toThrow(expect.objectContaining({ code: 'unsupported-table' }))
  })

  it.each([op(0x6649, 0, 0, 0, 0), op(0x664a, 0, 0, 0, 0),
    [...op(0x6649, 1, 0, 0, 0), ...op(0x664a, 255, 255, 255, 255)]].map(properties => ({ properties })))('preserves explicit zero depth refusal %#', ({ properties }) => {
    expect(() => inspectDoc(source(properties), { includeTables: true }))
      .toThrow(expect.objectContaining({ code: 'unsupported-table' }))
  })

  it.each([op(0x244b, 1), op(0x244c, 1), op(0x2416, 0), op(0x664a, 255, 255, 255, 255)].map(properties => ({ properties })))('refuses conflicting roles %#', ({ properties }) => {
    expect(() => inspectDoc(source(properties), { includeTables: true }))
      .toThrow(expect.objectContaining({ code: expect.stringMatching(/^(invalid-table-data|unsupported-table)$/) }))
  })

  it('uses final Boolean values without treating absent depth as an operation', () => {
    const result = inspectDoc(source([...op(0x244b, 0), ...op(0x244c, 0), ...op(0x2416, 0), ...op(0x2416, 1)]), { includeTables: true })
    expect(result.tables?.[0]?.level).toBe(1)
    expect(inspectDoc(source(op(0x664a, 1, 0, 0, 0)), { includeTables: true }).tables?.[0]?.level).toBe(1)
  })

  it('retains one compatibility decision with combined formatting inspection', () => {
    const result = inspectDoc(source(), { includeTables: true, includeCharacterFormatting: true })
    expect(result.diagnostics.filter(diagnostic => diagnostic.code === 'implicit-table-depth')).toHaveLength(1)
  })

  it('projects the same typed table while declaring compatibility in conversion', () => {
    const implicit = createDocxSourcePlan(source(), { lossPolicy: 'best-effort' })
    const explicit = createDocxSourcePlan(tableDocument([{ texts: ['甲', 'B'], edges: [0, 1440, 2880],
      cells: [{ flags: 0, width: 0 }, { flags: 0, width: 0 }] }]), { lossPolicy: 'best-effort' })
    expect(implicit.plan).toEqual(explicit.plan)
    expect(implicit.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'implicit-table-depth', kind: 'compatibility' }))
  })
})
