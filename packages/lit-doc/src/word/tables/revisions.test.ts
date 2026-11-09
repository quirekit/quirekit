import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { createDocxSourcePlan } from '../../conversion/plan'
import { DocConversionError } from '../../conversion/errors'
import { operation as op } from '../../testing/formatting'
import { tableDocument } from '../../testing/tables/document'
import { tableRevisionDocument } from '../../testing/tables/revisions'
import { createPropertyReader } from '../properties/reader'
import { resolveLimits } from '../../binary/limits'
import { validateTableOperations } from './identity'
import { readRowFormat } from './formatting'

/** @param values - Original serialized property bytes. @returns Independent bounded operation list. */
function operations(values: number[]) { return createPropertyReader(undefined, resolveLimits({})).read(Uint8Array.from(values)) }

describe('table property revision current-value ownership', () => {
  it('keeps source membership and current values while reporting omitted source history', () => {
    const bytes = tableRevisionDocument(), before = bytes.slice()
    expect(inspectDoc(bytes, { includeTables: true }).tables?.[0]?.rows[0]?.cells).toHaveLength(2)
    const result = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'table-property-revision-unprojected', kind: 'loss', source: 'table' }))
    expect(bytes).toEqual(before)
  })

  it('rejects strict conversion with a located revision loss instead of rejecting source topology', () => {
    let failure: unknown
    try { createDocxSourcePlan(tableRevisionDocument(), { lossPolicy: 'strict' }) } catch (error) { failure = error }
    expect(failure).toBeInstanceOf(DocConversionError)
    expect((failure as DocConversionError).report.diagnostics).toContainEqual(expect.objectContaining({ code: 'table-property-revision-unprojected', kind: 'loss', start: 0 }))
  })

  it.each([
    [op(0x3668, 1)], [op(0xd667, 7, 1, 0, 0, 0, 0, 0, 0)],
    [op(0x3668, 1), op(0x3668, 0), op(0x3668, 1)],
  ].map(values => ({ values })))('admits each bounded active metadata state %# without treating it as structural change', ({ values }) => {
    expect(() => validateTableOperations(operations(values.flat()))).not.toThrow()
  })

  it('clears both final metadata flags without discarding current row properties', () => {
    const result = createDocxSourcePlan(tableRevisionDocument([...op(0x3668, 0), ...op(0xd667, 7, 0, 255, 255, 255, 255, 255, 255)]), { lossPolicy: 'best-effort' })
    expect(result.report.diagnostics.some(item => item.code === 'table-property-revision-unprojected')).toBe(false)
  })

  it('compiles prior unmodified fields and later overrides in the same current tuple', () => {
    const reader = createPropertyReader(undefined, resolveLimits({})), bytes = [...op(0x3404, 1), ...op(0x9407, 136, 255), ...op(0x3668, 1),
      ...op(0x9407, 104, 1), ...op(0xd667, 7, 1, 0, 0, 0, 0, 0, 0)]
    const row = readRowFormat(reader.read(Uint8Array.from(bytes)), reader)
    expect(row).toMatchObject({ header: true, height: { value: 360, rule: 'atLeast' }, unsupportedOpcodes: [] })
  })

  it.each([
    op(0x3668, 2), op(0x3668, 255), op(0xd667, 7, 2, 0, 0, 0, 0, 0, 0),
    op(0xd667, 6, 0, 0, 0, 0, 0, 0), op(0xd667, 8, 0, 0, 0, 0, 0, 0, 0, 0),
  ].map(values => ({ values })))('validates unused metadata and active metadata equally %#', ({ values }) => {
    expect(() => validateTableOperations(operations(values))).toThrow(expect.objectContaining({ code: 'invalid-table-data' }))
  })

  it('keeps conditional styles, unknown operations, truncated operands and invalid roles closed', () => {
    expect(() => validateTableOperations(operations(op(0xd66a, 0)))).toThrow(expect.objectContaining({ code: 'unsupported-table' }))
    expect(() => validateTableOperations(operations(op(0x568b, 0, 0)))).toThrow(expect.objectContaining({ code: 'unsupported-table' }))
    expect(() => operations(op(0xd667, 7, 1, 0))).toThrow()
    expect(() => inspectDoc(tableRevisionDocument(op(0x6649, 0, 0, 0, 0)), { includeTables: true })).toThrow()
  })

  it('rejects cell-count conflicts and work-budget exhaustion despite valid metadata', () => {
    const document = tableDocument([{ texts: ['A', 'B'], edges: [0, 1440], cells: [{ flags: 0, width: 0 }], properties: op(0x3668, 1) }])
    expect(() => inspectDoc(document, { includeTables: true })).toThrow(expect.objectContaining({ code: 'invalid-table-data' }))
    expect(() => inspectDoc(tableRevisionDocument(), { includeTables: true, limits: { maxPropertyOperations: 1 } })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it('reports history loss even when optional geometry falls back to source topology', () => {
    const bytes = tableDocument([{ texts: ['A'], edges: [0, 1440], cells: [{ flags: 1 << 5, width: 0 }], properties: op(0x3668, 1) }])
    const result = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    expect(result.report.diagnostics.map(item => item.code)).toEqual(expect.arrayContaining(['table-geometry-unprojected', 'table-property-revision-unprojected']))
  })
})
