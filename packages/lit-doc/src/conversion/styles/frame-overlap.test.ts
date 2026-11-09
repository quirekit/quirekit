import { expect, it } from 'vitest'
import { compoundFixture } from '../../testing/compound'
import { conversionRecords } from '../../testing/conversion'
import { withCharacterRecords } from '../../testing/characters'
import { operation as op, withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'
import { createDocxSourcePlan } from '../plan'
import { DocConversionError } from '../errors'

/** @param properties - Complete authored style operations. @param owner - Active or unused style slot. @returns Original DOC with stable supported content. */
function sourceDocument(properties: number[], owner: number): Uint8Array {
  const paragraphs = withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
    cuts: [2048, 2050], records: [{ style: 15, bytes: op(0x2406, 1), odd: true }],
  }])
  const characters = withCharacterRecords(paragraphs, [{ cuts: [2048, 2050], records: [[]] }])
  const styled = withStyleDefinitions(characters, [{ index: 0 },
    { index: 15, parent: 0, properties: owner === 15 ? properties : [] },
    { index: 16, parent: 0, properties: owner === 16 ? properties : [] }])
  return compoundFixture(conversionRecords(styled, 2))
}

it.each([{ value: 0, owner: 15 }, { value: 1, owner: 15 }, { value: 0, owner: 16 }, { value: 1, owner: 16 }])(
  'reports explicit overlap flag $value at style $owner and keeps supported output stable', ({ value, owner }) => {
    const bytes = sourceDocument(op(0x2462, value), owner), before = bytes.slice()
    const result = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    const control = createDocxSourcePlan(sourceDocument([], owner), { lossPolicy: 'best-effort' })
    expect(result.plan).toEqual(control.plan)
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      code: 'legacy-style-frame-overlap', kind: 'compatibility', source: 'styles',
    }))
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'source-properties-unprojected',
      kind: 'loss', source: `style:${owner}`, message: expect.stringContaining('0x2462') }))
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(DocConversionError)
    expect(bytes).toEqual(before)
  })

it.each([op(0x2462, 2), op(0x2462, 255), [...op(0x2462, 1), ...op(0x2416, 1)]])(
  'recovers text from invalid style operations while retaining strict validation %#', (...properties: number[]) => {
    const bytes = sourceDocument(properties, 16)
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' }))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
    expect(createDocxSourcePlan(bytes).report.recovery?.cause).toBe('invalid-formatting-data')
  })

it('omits a truncated unused style operation while retaining the rich document', () => {
  const bytes = sourceDocument([0x62, 0x24], 16)
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  const result = createDocxSourcePlan(bytes)
  expect(result.report.recovery).toBeUndefined()
  expect(result.plan).toEqual(createDocxSourcePlan(sourceDocument([], 16)).plan)
  expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
    code: 'property-tail-omitted', kind: 'loss', source: 'properties',
  }))
})
