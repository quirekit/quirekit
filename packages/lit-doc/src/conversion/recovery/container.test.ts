import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { withCharacterRecords } from '../../testing/characters'
import { compoundFixture, fixtureEntry } from '../../testing/compound'
import { conversionRecords } from '../../testing/conversion'
import { withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'
import { createDocxSourcePlan } from '../plan'

/** @param extra - Independently authored optional streams. @param normalTable - Whether the selected table avoids miniature storage. @returns Valid rich source with known text and optional streams. */
function streams(extra: Record<string, Uint8Array> = {}, normalTable = false): Record<string, Uint8Array> {
  let source = withParagraphRecords(wordStreams([{ units: [65, 66, 67, 13], unicode: false }]), [{ cuts: [2048, 2052] }])
  source = withCharacterRecords(source, [{ cuts: [2048, 2052] }])
  source = conversionRecords(withStyleDefinitions(source, [{ index: 0 }]), 4)
  if (normalTable) {
    const padded = new Uint8Array(Math.max(4096, source['1Table']!.length))
    padded.set(source['1Table']!)
    source = { ...source, '1Table': padded }
  }
  return { ...source, ...extra }
}

it.each([3, 4] as const)('preserves the complete plan when an unused source stream is unreadable in v%s', version => {
  const bytes = compoundFixture(streams({ Unused: new Uint8Array(4096) }), { version })
  new DataView(bytes.buffer).setUint32(fixtureEntry(bytes, 'Unused') + 116, 0xffffffff, true)
  const before = bytes.slice(), actual = createDocxSourcePlan(bytes)
  expect(actual.plan).toEqual(createDocxSourcePlan(compoundFixture(streams(), { version })).plan)
  expect(actual.report.recovery).toBeUndefined()
  expect(actual.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-unreadable-streams-omitted', kind: 'loss', source: 'container' }))
  expect(() => inspectDoc(bytes)).toThrow(expect.objectContaining({ code: 'invalid-cfb' }))
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'invalid-cfb' }))
  expect(bytes).toEqual(before)
})

it('uses the FIB-selected table before an overlapping unused table can claim its bytes', () => {
  const bytes = compoundFixture(streams({ '0Table': new Uint8Array(4096) }, true))
  const view = new DataView(bytes.buffer)
  view.setUint32(fixtureEntry(bytes, '0Table') + 116, view.getUint32(fixtureEntry(bytes, '1Table') + 116, true), true)
  const actual = createDocxSourcePlan(bytes)
  expect(actual.plan).toEqual(createDocxSourcePlan(compoundFixture(streams({}, true))).plan)
  expect(actual.report.recovery).toBeUndefined()
  expect(actual.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-unreadable-streams-omitted', kind: 'loss' }))
})

it('recovers ordinary text after a requested optional Data stream fails', () => {
  const bytes = compoundFixture(streams({ Data: new Uint8Array(4096) }))
  new DataView(bytes.buffer).setUint32(fixtureEntry(bytes, 'Data') + 116, 0xffffffff, true)
  const actual = createDocxSourcePlan(bytes)
  expect(actual.report.recovery?.cause).toBe('invalid-cfb')
  expect(JSON.stringify(actual.plan)).toContain('"children":["ABC"]')
  expect(actual.plan.resources).toEqual([])
  expect(actual.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-unreadable-streams-omitted', kind: 'loss' }))
})

it('preserves complete normal-stream conversion when unused miniature storage has a partial final unit', () => {
  const bytes = compoundFixture(streams({ Small: Uint8Array.of(7) }, true))
  new DataView(bytes.buffer).setUint32(fixtureEntry(bytes, 'Root Entry') + 120, 65, true)
  const actual = createDocxSourcePlan(bytes)
  expect(actual.plan).toEqual(createDocxSourcePlan(compoundFixture(streams({}, true))).plan)
  expect(actual.report.recovery).toBeUndefined()
  expect(actual.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-stream-truncated', kind: 'loss' }))
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(/mini-sector aligned/)
})

it.each(['WordDocument', '1Table'])('returns the precise failure when required %s bytes cannot be acquired', name => {
  const bytes = compoundFixture(streams())
  new DataView(bytes.buffer).setUint32(fixtureEntry(bytes, name) + 116, 0xffffffff, true)
  expect(() => createDocxSourcePlan(bytes)).toThrow(expect.objectContaining({ code: 'invalid-cfb' }))
})
