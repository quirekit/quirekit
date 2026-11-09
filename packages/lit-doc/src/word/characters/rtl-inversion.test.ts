import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { withCharacterRecords } from '../../testing/characters'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'
import { conversionRecords } from '../../testing/conversion'
import { createDocxSourcePlan } from '../../conversion/plan'
import { defaultCharacterFormat } from './formatting/defaults'
import { applyCharacterToggle } from './formatting/toggles'

/** @param operations - Ordered direct changes to two ordinary characters. @param piece - Optional later piece changes. @returns Complete original DOC including an independently formatted paragraph mark. */
function document(operations: readonly number[], piece?: readonly number[]) {
  let streams = withStyleDefinitions(withCharacterRecords(withParagraphRecords(wordStreams([{ units: [65, 66, 13], unicode: false }]), [
    { cuts: [2048, 2051] },
  ]), [{ cuts: [2048, 2049, 2050, 2051], records: [operations, operations, undefined] }]), [
    { index: 0 }, { index: 15, kind: 2, characters: op(0x0835, 1) },
  ])
  if (piece) streams = withPiecePropertyGroup(streams, piece, 0)
  return compoundFixture(conversionRecords(streams, 3))
}

it.each([[0, false], [1, true], [0x80, null], [0x81, true]] as const)(
  'keeps automatic direction distinct from the source flag needed by toggle %i', (mode, expected) => {
    const bytes = document(op(0x085a, mode)), before = bytes.slice()
    const result = inspectDoc(bytes, { includeCharacterFormatting: true })
    expect(result.characterRuns?.map(run => run.baseFormat.rightToLeft)).toEqual([expected, expected, null])
    expect(result.diagnostics.filter(item => item.code === 'implicit-rtl-style-inversion')).toHaveLength(mode === 0x81 ? 1 : 0)
    expect(bytes).toEqual(before)
  })

it('inverts the stable style flag rather than the last direct value, including later piece changes', () => {
  const result = inspectDoc(document([...op(0x085a, 1), ...op(0x085a, 0x81), ...op(0x085a, 0x81)], op(0x085a, 0x81)), { includeCharacterFormatting: true })
  expect(result.characterRuns?.every(run => run.baseFormat.rightToLeft === true)).toBe(true)
  expect(result.diagnostics.filter(item => item.code === 'implicit-rtl-style-inversion')).toHaveLength(1)
})

it.each([0x4a30, 0x2a33])('preserves admitted inverse direction across reset %i and isolates separate inspections', reset => {
  const operations = [...op(0x085a, 0x81), ...(reset === 0x4a30 ? op(reset, 15, 0) : op(reset, 0))]
  for (let index = 0; index < 2; index++) {
    const result = inspectDoc(document(operations), { includeCharacterFormatting: true })
    expect(result.characterRuns?.map(run => run.baseFormat.rightToLeft)).toEqual([true, true, null])
    expect(result.diagnostics.filter(item => item.code === 'implicit-rtl-style-inversion')).toHaveLength(1)
  }
})

it.each([op(0x0882, 0x81), op(0x085a, 2)].map(operations => ({ operations })))(
  'continues rejecting automatic complex-script inversion and invalid toggles: %j', ({ operations }) => {
    expect(() => inspectDoc(document(operations), { includeCharacterFormatting: true }))
      .toThrow(expect.objectContaining({ code: operations[0] === 0x82 ? 'unsupported-formatting' : 'invalid-formatting-data' }))
  })

it('charges repeated compatibility operations and leaves storage-only inspection independent', () => {
  const bytes = document(op(0x085a, 0x81))
  expect(inspectDoc(bytes).diagnostics.some(item => item.code === 'implicit-rtl-style-inversion')).toBe(false)
  expect(() => inspectDoc(bytes, { includeCharacterFormatting: true, limits: { maxPropertyOperations: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it.each([false, true])('keeps explicit style direction %s authoritative for every toggle', inherited => {
  const style = { ...defaultCharacterFormat(0, { ascii: 0, other: 0, eastAsia: 0, complex: null }), rightToLeft: inherited }
  for (const [mode, expected] of [[0, false], [1, true], [0x80, inherited], [0x81, !inherited]] as const) {
    const target = { ...style, rightToLeft: !inherited }
    applyCharacterToggle(target, style, { opcode: 0x085a, operand: Uint8Array.of(mode) })
    expect(target.rightToLeft).toBe(expected)
    expect(style.rightToLeft).toBe(inherited)
  }
})

it('retains current-value compatibility and future inverse-inheritance approximation in the strict report', () => {
  const bytes = document(op(0x085a, 0x81))
  const diagnostic = expect.objectContaining({ code: 'implicit-rtl-style-inversion', kind: 'compatibility', source: 'characters' })
  const approximation = expect.objectContaining({ code: 'direct-inverse-toggle-approximated', kind: 'approximation' })
  const result = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(result.report.diagnostics).toEqual(expect.arrayContaining([diagnostic, approximation]))
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ report: expect.objectContaining({
    diagnostics: expect.arrayContaining([diagnostic, approximation]),
  }) }))
})
