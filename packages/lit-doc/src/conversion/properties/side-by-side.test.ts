import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { conversionRecords } from '../../testing/conversion'
import { withCharacterRecords } from '../../testing/characters'
import { operation as op, withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'
import { resolveLimits } from '../../binary/limits'
import { createPropertyReader } from '../../word/properties/reader'
import { applyParagraphProperties } from '../../word/paragraphs/formatting/apply'
import { defaultParagraphFormat } from '../../word/paragraphs/formatting/defaults'
import { DocConversionError } from '../errors'
import { createDocxSourcePlan } from '../plan'

/**
 * Places one legacy flag in the actual style or direct-property pipeline.
 * @param value - Raw flag, or absent for the ordinary control.
 * @param owner - Explicit source layer, including an unreferenced definition.
 * @returns Independent DOC bytes with the same body and supported formatting.
 */
function sourceDocument(value: number | undefined, owner: 'direct' | 'style' | 'unused' = 'direct'): Uint8Array {
  const flag = value === undefined ? [] : op(0x2404, value)
  const direct = [...op(0x2406, 1), ...(owner === 'direct' ? flag : [])]
  const streams = withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
    cuts: [2048, 2050], records: [{ style: 15, bytes: direct, odd: direct.length % 2 === 1 }],
  }])
  const characters = withCharacterRecords(streams, [{ cuts: [2048, 2050], records: [[]] }])
  const styled = withStyleDefinitions(characters, [{ index: 0 },
    { index: 15, parent: 0, properties: owner === 'style' ? flag : [] },
    { index: 16, parent: 0, properties: owner === 'unused' ? flag : [] }])
  return compoundFixture(conversionRecords(styled, 2))
}

it.each([{ value: 0, owner: 'direct' }, { value: 1, owner: 'direct' },
  { value: 0, owner: 'style' }, { value: 1, owner: 'style' }] as const)(
  'keeps supported fields and identifies the $owner legacy flag $value', ({ value, owner }) => {
    const source = inspectDoc(sourceDocument(value, owner), { includeParagraphFormatting: true })
    const control = inspectDoc(sourceDocument(undefined, owner), { includeParagraphFormatting: true })
    const format = source.paragraphs![0]!.baseFormat!
    expect(format.unsupportedOpcodes).toEqual([0x2404])
    expect({ ...format, unsupportedOpcodes: [] }).toEqual(control.paragraphs![0]!.baseFormat)
    expect(source.text).toBe(control.text)
  })

it.each(['direct', 'style', 'unused'] as const)('reports the %s flag as loss in actual conversion and refuses strict loss', owner => {
  const bytes = sourceDocument(1, owner)
  const { report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  const authority = owner === 'direct' ? 'paragraph' : owner === 'style' ? 'style:15' : 'style:16'
  expect(report.lossy).toBe(true)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'source-properties-unprojected',
    kind: 'loss', source: authority, message: expect.stringContaining('0x2404') }))
  let failure: unknown
  try { createDocxSourcePlan(bytes, { lossPolicy: 'strict' }) } catch (error) { failure = error }
  expect(failure).toBeInstanceOf(DocConversionError)
  expect((failure as DocConversionError).report.diagnostics).toContainEqual(expect.objectContaining({
    code: 'source-properties-unprojected', kind: 'loss', source: authority, message: expect.stringContaining('0x2404'),
  }))
})

it.each([2, 255])('recovers after an invalid legacy flag byte %i while retaining strict validation', value => {
  const bytes = sourceDocument(value)
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  expect(createDocxSourcePlan(bytes).report.recovery?.cause).toBe('invalid-formatting-data')
})

it('keeps truncated operands and other unadmitted ordinary operations rejected', () => {
  for (const [bytes, code] of [[[0x04, 0x24], 'invalid-formatting-data'], [op(0x2408, 1), 'unsupported-formatting']] as const) {
    const reader = createPropertyReader(undefined, resolveLimits({}))
    expect(() => applyParagraphProperties(defaultParagraphFormat(0), reader.read(Uint8Array.from(bytes)), reader))
      .toThrow(expect.objectContaining({ code }))
  }
})
