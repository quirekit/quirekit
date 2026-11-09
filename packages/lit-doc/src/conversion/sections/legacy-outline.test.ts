import { expect, it } from 'vitest'
import { compoundFixture } from '../../testing/compound'
import { withCharacterRecords } from '../../testing/characters'
import { withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'
import { conversionRecords } from '../../testing/conversion'
import { createDocxSourcePlan } from '../plan'

/** @param opcode - Complete independent opcode. @param bytes - Exact counted operand. @returns Original wire vector. */
function operation(opcode: number, bytes: readonly number[]): number[] { return [opcode & 255, opcode >>> 8, ...bytes] }
/** @param counts - Before/after lengths placed in successive levels. @returns Fixed OLST80 counted payload. */
function outline(counts: readonly number[] = [1, 1]): number[] {
  const bytes = new Array<number>(212).fill(0)
  for (const [index, length] of counts.entries()) bytes[Math.floor(index / 2) * 16 + index % 2 + 1] = length
  return [212, ...bytes]
}
/** @param extra - Counted section operations appended after the original page tuple. @returns Complete independently authored DOC. */
function document(extra: readonly number[]): Uint8Array {
  let streams = withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{ cuts: [2048, 2050] }])
  streams = withCharacterRecords(streams, [{ cuts: [2048, 2050] }])
  streams = withStyleDefinitions(streams, [{ index: 0 }]); streams = conversionRecords(streams, 2)
  const table = new DataView(streams['1Table']!.buffer), original = streams.WordDocument!, originalView = new DataView(original.buffer)
  const directory = originalView.getUint32(154 + 6 * 8, true), offset = table.getUint32(directory + 10, true)
  const word = new Uint8Array(original.length + extra.length); word.set(original); word.set(extra, original.length)
  const view = new DataView(word.buffer); view.setUint16(offset, originalView.getUint16(offset, true) + extra.length, true)
  view.setUint32(64, word.length, true)
  return compoundFixture({ ...streams, WordDocument: word })
}

it.each([[0, 0], [0, 32], [17, 15], [4, 4, 4, 4, 4, 4, 4, 4], [...new Array<number>(17).fill(1), 15]].map(counts => [counts]))
  ('recognizes bounded legacy outline counts %j without installing numbering', counts => {
  const bytes = document(operation(0xd202, outline(counts))), original = bytes.slice()
  const actual = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(actual.plan).toEqual(createDocxSourcePlan(document([]), { lossPolicy: 'best-effort' }).plan)
  const diagnostic = expect.objectContaining({ code: 'legacy-section-outline-unprojected', kind: 'loss', source: 'section:0' })
  expect(actual.report.diagnostics).toContainEqual(diagnostic)
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ report: expect.objectContaining({ diagnostics: expect.arrayContaining([diagnostic]) }) }))
  expect(bytes).toEqual(original)
})

it.each([
  operation(0xd202, [211, ...new Array<number>(211).fill(0)]),
  operation(0xd202, [248, ...new Array<number>(248).fill(0)]),
  operation(0xd202, outline([17, 16])), operation(0xd202, outline([8, 8, 8, 9])),
  operation(0xd202, outline(new Array<number>(18).fill(2))),
  operation(0xd238, [35, ...new Array<number>(35).fill(0)]),
  operation(0xd238, [36, ...new Array<number>(35).fill(0), 1]),
].map(bytes => [bytes]))('recovers text after an invalid legacy outline record %#', bytes => {
  const input = document(bytes)
  expect(() => createDocxSourcePlan(input, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  expect(createDocxSourcePlan(input).report.recovery?.cause).toBe('invalid-formatting-data')
})

it('reports the independent nine-color array while keeping unknown adjacent records refused', () => {
  const colors = [36, ...Array.from({ length: 9 }, () => [0x11, 0x22, 0x33, 255]).flat()]
  const actual = createDocxSourcePlan(document(operation(0xd238, colors)), { lossPolicy: 'best-effort' })
  expect(actual.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'legacy-section-outline-unprojected', kind: 'loss', message: expect.stringContaining('colors') }))
  const unknown = document(operation(0xd1ff, [2, 3, 0]))
  expect(() => createDocxSourcePlan(unknown, { lossPolicy: 'strict' })).toThrow(/Compound section/)
  expect(createDocxSourcePlan(unknown).report.recovery?.cause).toBe('unsupported-formatting')
})
