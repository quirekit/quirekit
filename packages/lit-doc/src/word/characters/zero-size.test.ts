import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { zeroSizeDocument } from '../../testing/zero-size'
import { operation as op } from '../../testing/formatting'
import { createDocxSourcePlan } from '../../conversion/plan'
import { DocConversionError } from '../../conversion/errors'
import { createPropertyReader } from '../properties/reader'
import { resolveLimits } from '../../binary/limits'
import { defaultCharacterFormat } from './formatting/defaults'
import { readMajoritySelection } from './formatting/majority/selection'

it.each(['direct', 'piece', 'paragraph', 'character'] as const)('retains diagnosed source zero from %s without substituting an inherited size', carrier => {
  const bytes = zeroSizeDocument(carrier), before = bytes.slice(), actual = inspectDoc(bytes, { includeCharacterFormatting: true })
  expect(actual.characterRuns?.every(run => run.baseFormat.fontSizeHalfPoints === 0)).toBe(true)
  expect(actual.diagnostics.filter(item => item.code === 'legacy-zero-font-size')).toHaveLength(1)
  const result = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(result.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'zero-font-size-unportable', kind: 'loss' }))
  expect(result.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'zero-font-size-host-limit', kind: 'host-limit' }))
  expect(bytes).toEqual(before)
})

it('retains an unused source style zero without treating ordinary text as zero-sized', () => {
  const bytes = zeroSizeDocument('unused-character'), source = inspectDoc(bytes, { includeCharacterFormatting: true })
  expect(source.characterRuns?.every(run => run.baseFormat.fontSizeHalfPoints === 20)).toBe(true)
  expect(source.diagnostics.some(item => item.code === 'legacy-zero-font-size')).toBe(false)
  expect(createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' }).report.diagnostics).toContainEqual(expect.objectContaining({ code: 'zero-font-size-unportable', source: 'style:12', kind: 'loss' }))
})

it.each([op(0x4a43, 28, 0), op(0x2a33, 0), op(0x4a30, 10, 0)].map(tail => ({ tail })))('keeps later positive size, clear and style replacement authoritative %#', ({ tail }) => {
  const bytes = zeroSizeDocument('direct', tail), actual = inspectDoc(bytes, { includeCharacterFormatting: true })
  expect(actual.characterRuns?.every(run => run.baseFormat.fontSizeHalfPoints === (tail[0] === 0x43 ? 28 : 20))).toBe(true)
  expect(actual.diagnostics.filter(item => item.code === 'legacy-zero-font-size')).toHaveLength(1)
  expect(createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' }).report.diagnostics.some(item => item.code === 'zero-font-size-unportable')).toBe(false)
})

it('fails strict portable conversion with the explicit zero loss report', () => {
  let failure: unknown
  try { createDocxSourcePlan(zeroSizeDocument(), { lossPolicy: 'strict' }) } catch (error) { failure = error }
  expect(failure).toBeInstanceOf(DocConversionError)
  expect((failure as DocConversionError).report.diagnostics).toContainEqual(expect.objectContaining({ code: 'zero-font-size-unportable', kind: 'loss' }))
})

it.each([1, 3277, 65535])('does not admit ordinary invalid size %i along with the zero compatibility case', value => {
  expect(() => inspectDoc(zeroSizeDocument('direct', op(0x4a43, value & 255, value >> 8)), { includeCharacterFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it('keeps nonportable zero outside Majority comparisons and preserves the work budget', () => {
  const defaults = defaultCharacterFormat(0, { ascii: 0, eastAsia: 0, other: 0, complex: 0 }), reader = createPropertyReader(undefined, resolveLimits({}))
  expect(() => readMajoritySelection(Uint8Array.from([4, ...op(0x4a43, 0, 0)]), defaults, reader))
    .toThrow(expect.objectContaining({ code: 'unsupported-formatting' }))
  expect(() => inspectDoc(zeroSizeDocument(), { includeCharacterFormatting: true, limits: { maxPropertyOperations: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})
