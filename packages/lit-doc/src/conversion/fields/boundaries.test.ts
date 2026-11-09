import { expect, it } from 'vitest'
import { compoundFixture } from '../../testing/compound'
import { fieldDocument } from '../../testing/fields/conversion'
import { headerDocumentStreams } from '../../testing/header-footer/document'
import { tableDocument } from '../../testing/tables/document'
import { createDocxSourcePlan } from '../plan'

it('keeps a result spanning paragraphs in the same physical cell', () => {
  const bytes = tableDocument([{ texts: ['\u0013QUOTE\u0014A\rB\u0015'], edges: [0, 1000] }])
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })).not.toThrow()
})

it('keeps indexed pairing validation in strict mode and recovers after a hierarchy conflict', () => {
  const bytes = fieldDocument('\u0013A\u0013B\u00141\u0015\u00142\u0015\r', { tables: [{ kind: 'main', tokens: [
    { position: 0, code: 19, value: 7 }, { position: 4, code: 20, value: 255 }, { position: 6, code: 21, value: 0x80 },
  ] }] })
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'invalid-field-data' }))
  expect(createDocxSourcePlan(bytes).report.recovery?.cause).toBe('invalid-field-data')
  const recovered = JSON.stringify(createDocxSourcePlan(bytes).plan)
  expect(recovered).not.toContain('"children":["1"]')
  expect(recovered).not.toContain('"children":["2"]')
})

it('does not refund field work spent by a refused optional Story before its valid neighbor', () => {
  const bytes = compoundFixture(headerDocumentStreams([['\u0013broken\r\r', '\u0013PAGE\u00141\u0015\r\r', '', '', '', '']]))
  const complete = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(complete.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'header-footer-content-unprojected', kind: 'loss' }))
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxFields: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})
