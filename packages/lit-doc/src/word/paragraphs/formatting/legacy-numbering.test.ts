import { expect, it } from 'vitest'
import { inspectDoc } from '../../../inspection'
import { createDocxSourcePlan } from '../../../conversion/plan'
import { compoundFixture } from '../../../testing/compound'
import { withCharacterRecords } from '../../../testing/characters'
import { operation as op, withStyleDefinitions } from '../../../testing/formatting'
import { withParagraphRecords } from '../../../testing/paragraphs'
import { wordStreams } from '../../../testing/word'
import { conversionRecords } from '../../../testing/conversion'

/** @param before - Prefix code units. @param after - Suffix code units. @returns Independent ANLD80 payload with a counted 32-code-unit slot. */
function descriptor(before = 1, after = 0): number[] {
  const bytes = new Array<number>(84).fill(0)
  bytes[0] = 0xff; bytes[1] = before; bytes[2] = after
  bytes[10] = 1; bytes[20] = 0xb7; bytes[21] = 0xf0
  return op(0xc63e, 84, ...bytes)
}

/** @param properties - Exact direct or style operations. @param location - Chosen source authority. @returns Complete independently authored Word file. */
function source(properties: readonly number[], location: 'direct' | 'style' | 'unused' = 'direct'): Uint8Array {
  const direct = location === 'direct' ? properties : []
  let streams = withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]),
    [{ cuts: [2048, 2050], records: [{ style: location === 'style' ? 15 : 0, bytes: direct, odd: direct.length % 2 === 1 }] }])
  streams = withCharacterRecords(streams, [{ cuts: [2048, 2050] }])
  streams = withStyleDefinitions(streams, [{ index: 0 }, { index: 15, parent: 0, properties: location === 'direct' ? [] : properties }])
  return compoundFixture(conversionRecords(streams, 2))
}

it.each([[0, 0], [1, 0], [0, 32], [32, 0], [17, 15]])('reads bounded prefix/suffix %i/%i while retaining unprojected identity', (before, after) => {
  const bytes = source([...descriptor(before, after), ...op(0x2405, 1)]), snapshot = bytes.slice()
  const actual = inspectDoc(bytes, { includeParagraphFormatting: true })
  const control = inspectDoc(source(op(0x2405, 1)), { includeParagraphFormatting: true })
  expect(actual.paragraphs?.[0]?.baseFormat?.unsupportedOpcodes).toEqual([0xc63e])
  expect({ ...actual.paragraphs![0]!.baseFormat, unsupportedOpcodes: [] }).toEqual(control.paragraphs![0]!.baseFormat)
  expect(actual.text).toBe('A\r')
  expect(bytes).toEqual(snapshot)
})

it.each([
  { properties: op(0xc63e, 83, ...new Array<number>(83).fill(0)) },
  { properties: op(0xc63e, 88, ...new Array<number>(88).fill(0)) },
  { properties: op(0xc63e, 84, ...new Array<number>(83).fill(0)) },
  { properties: descriptor(17, 16) },
])('rejects an incomplete, expanded or out-of-range descriptor %#', ({ properties }) => {
  expect(() => inspectDoc(source(properties), { includeParagraphFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it('does not reinterpret opaque legacy fields or admit an unknown neighboring operation', () => {
  const properties = descriptor()
  properties[3 + 19] = 0xff
  const result = inspectDoc(source(properties), { includeParagraphFormatting: true })
  expect(result.paragraphs?.[0]?.baseFormat?.unsupportedOpcodes).toEqual([0xc63e])
  expect(() => inspectDoc(source(op(0xc63d, 0)), { includeParagraphFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'unsupported-formatting' }))
})

it('reads the independent legacy color without changing ordinary paragraph or text values', () => {
  const properties = [...op(0x6654, 0x33, 0x22, 0x11, 0), ...op(0x2405, 1)]
  const result = inspectDoc(source(properties), { includeParagraphFormatting: true })
  expect(result.paragraphs?.[0]?.baseFormat).toMatchObject({ keepLines: true, unsupportedOpcodes: [0x6654] })
  expect(() => inspectDoc(source(op(0x6654, 1, 2, 3)), { includeParagraphFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it.each(['direct', 'style', 'unused'] as const)('retains loss reporting from the %s authority without creating a numbering instance', location => {
  const normal = source(op(0x2405, 1), location)
  const legacy = source([...descriptor(), ...op(0x2405, 1)], location)
  const actual = createDocxSourcePlan(legacy, { lossPolicy: 'best-effort' })
  expect(actual.plan).toEqual(createDocxSourcePlan(normal, { lossPolicy: 'best-effort' }).plan)
  const diagnostic = expect.objectContaining({ code: 'source-properties-unprojected', kind: 'loss',
    message: expect.stringContaining('0xc63e') })
  expect(actual.report.diagnostics).toContainEqual(diagnostic)
  expect(() => createDocxSourcePlan(legacy, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({
    report: expect.objectContaining({ diagnostics: expect.arrayContaining([diagnostic]) }),
  }))
})

it('deduplicates inherited descriptor identity while retaining the independent color loss', () => {
  const properties = [...descriptor(), ...descriptor(), ...op(0x6654, 0, 0, 0, 0)]
  const result = inspectDoc(source(properties, 'style'), { includeParagraphFormatting: true })
  expect(result.paragraphs?.[0]?.baseFormat?.unsupportedOpcodes).toEqual([0x6654, 0xc63e])
})
