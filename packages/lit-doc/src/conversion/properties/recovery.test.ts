import { expect, it } from 'vitest'
import { propertyRecoveryDocument } from '../../testing/property-recovery'
import { createDocxSourcePlan } from '../plan'
import { createConversionSource } from '../source/read'
import { readDocumentSource } from '../../word/document/read'

it.each(['variable', 'tabs', 'missing-data', 'section', 0x6645, 0x6646] as const)(
  'keeps rich paragraph fields after bounded property recovery %s', kind => {
    const bytes = propertyRecoveryDocument(kind), before = bytes.slice()
    const source = createConversionSource(readDocumentSource(bytes, {}), true)
    expect(source.paragraphFormats[0]!).toMatchObject({ alignment: { value: 1 }, keepNext: true, styleIndex: 15 })
    const result = createDocxSourcePlan(bytes)
    expect(result.report.recovery).toBeUndefined()
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      code: typeof kind === 'number' ? 'indirect-property-compatibility' : kind === 'missing-data' ? 'indirect-property-omitted' : 'property-tail-omitted',
      kind: typeof kind === 'number' ? 'compatibility' : 'loss', source: 'properties',
    }))
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow()
    expect(bytes).toEqual(before)
  })
