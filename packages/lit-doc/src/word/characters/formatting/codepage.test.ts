import { expect, it } from 'vitest'
import { inspectDoc } from '../../../inspection'
import { createDocxSourcePlan } from '../../../conversion/plan'
import { compoundFixture } from '../../../testing/compound'
import { withCharacterRecords } from '../../../testing/characters'
import { operation, withStyleDefinitions } from '../../../testing/formatting'
import { withParagraphRecords } from '../../../testing/paragraphs'
import { wordStreams } from '../../../testing/word'
import { conversionRecords } from '../../../testing/conversion'

/** @param properties - Ordered character operations. @returns Independently encoded compressed-text source and valid conversion authorities. */
function source(properties: readonly number[]): Uint8Array {
  let streams = wordStreams([{ units: [0x80, 65, 13], unicode: false }])
  // Bind the raw code units to independently built paragraph/run indexes before
  // supplying style definitions and the conversion's font/page authorities.
  streams = withParagraphRecords(streams, [{ cuts: [2048, 2051] }])
  streams = withCharacterRecords(streams, [{ cuts: [2048, 2050, 2051], records: [properties, undefined] }])
  streams = withStyleDefinitions(streams, [{ index: 0 }, { index: 15, kind: 2, characters: operation(0x0836, 1) }])
  return compoundFixture(conversionRecords(streams, 3))
}

it.each([0, 932, 1251, 1252, 65535])('reads bounded legacy codepage %i without reinterpreting source text or other character fields', value => {
  const codepage = operation(0x486b, value & 255, value >>> 8)
  const regular = [...operation(0x0835, 1), ...operation(0x4a43, 28, 0), ...operation(0x4873, 9, 4)]
  const bytes = source([...codepage, ...regular])
  const before = bytes.slice()
  const actual = inspectDoc(bytes, { includeCharacterFormatting: true })
  const control = inspectDoc(source(regular), { includeCharacterFormatting: true })
  expect(actual.text).toBe('\u0080A\r')
  expect(actual.text).toBe(control.text)
  expect(actual.characterRuns?.[0]?.baseFormat.unsupportedOpcodes).toEqual([0x486b])
  expect({ ...actual.characterRuns![0]!.baseFormat, unsupportedOpcodes: [] }).toEqual(control.characterRuns![0]!.baseFormat)
  expect(actual.characterRuns?.[1]).toEqual(control.characterRuns?.[1])
  expect(bytes).toEqual(before)
})

it.each([0x4a30, 0x2a33])('retains one unprojected codepage identity across character reset %i', reset => {
  const codepage = operation(0x486b, 0xe4, 4)
  const change = reset === 0x4a30 ? operation(reset, 15, 0) : operation(reset, 0)
  const actual = inspectDoc(source([...codepage, ...operation(0x0835, 1), ...change, ...codepage]), { includeCharacterFormatting: true })
  expect(actual.characterRuns?.[0]?.baseFormat).toMatchObject({ bold: false, italic: reset === 0x4a30,
    unsupportedOpcodes: [0x486b] })
})

it('keeps incomplete operands and an unadmitted adjacent character property outside the compatibility boundary', () => {
  expect(() => inspectDoc(source(operation(0x486b, 1)), { includeCharacterFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  expect(() => inspectDoc(source(operation(0x486c, 1, 0)), { includeCharacterFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'unsupported-formatting' }))
})

it('preserves the complete typed plan and makes the codepage loss explicit in both conversion policies', () => {
  const normal = source(operation(0x0835, 1))
  const legacy = source([...operation(0x486b, 0xe4, 4), ...operation(0x0835, 1)])
  const control = createDocxSourcePlan(normal, { lossPolicy: 'best-effort' })
  const actual = createDocxSourcePlan(legacy, { lossPolicy: 'best-effort' })
  expect(actual.plan).toEqual(control.plan)
  const diagnostic = expect.objectContaining({ code: 'source-properties-unprojected', kind: 'loss', source: 'character',
    message: expect.stringContaining('0x486b') })
  expect(actual.report.diagnostics).toContainEqual(diagnostic)
  expect(() => createDocxSourcePlan(legacy, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({
    report: expect.objectContaining({ diagnostics: expect.arrayContaining([diagnostic]) }),
  }))
})
