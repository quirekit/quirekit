import { expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { createDocxSourcePlan } from '../../conversion/plan'
import { compoundFixture, fixtureEntry } from '../../testing/compound'
import { wordStreams } from '../../testing/word'
import { openCompoundFile } from '../reader'

const limits = resolveLimits({})

it.each([3, 4] as const)('uses slot zero for a damaged root type in v%s without changing source bytes', version => {
  const bytes = compoundFixture({ Body: Uint8Array.of(65, 66) }, { version })
  const view = new DataView(bytes.buffer)
  view.setUint8(fixtureEntry(bytes, 'Root Entry') + 66, 0)
  const before = bytes.slice()
  expect(() => openCompoundFile(bytes, limits)).toThrow(/type/)
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('Body')).toEqual(Uint8Array.of(65, 66))
  expect(reader.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-root-type-recovered' }))
  expect(bytes).toEqual(before)
})

it.each([3, 4] as const)('recovers detached streams only after a broken root-level link in a flat v%s directory', version => {
  const bytes = compoundFixture({ A: Uint8Array.of(65), Body: new Uint8Array(4096).fill(66) }, { version })
  const view = new DataView(bytes.buffer)
  view.setUint32(fixtureEntry(bytes, 'A') + 72, 0x7fffffff, true)
  const before = bytes.slice()
  expect(() => openCompoundFile(bytes, limits)).toThrow(/directory/)
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('Body')).toEqual(new Uint8Array(4096).fill(66))
  expect(reader.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-flat-directory-recovered' }))
  expect(reader.readRootStream('BODY')).toEqual(reader.readRootStream('Body'))
  expect(bytes).toEqual(before)
})

it.each(['storage', 'unknown', 'stream-child', 'unknown-empty-name'] as const)('keeps orphan identity unresolved with %s elsewhere in the directory', kind => {
  const bytes = compoundFixture({ A: Uint8Array.of(65), Body: new Uint8Array(4096), Other: Uint8Array.of(67) })
  const view = new DataView(bytes.buffer), a = fixtureEntry(bytes, 'A'), other = fixtureEntry(bytes, 'Other')
  view.setUint32(a + 72, 0x7fffffff, true)
  if (kind === 'storage') view.setUint8(other + 66, 1)
  if (kind === 'unknown' || kind === 'unknown-empty-name') view.setUint8(other + 66, 0)
  if (kind === 'unknown-empty-name') view.setUint16(other + 64, 0, true)
  if (kind === 'stream-child') view.setUint32(other + 76, 1, true)
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('Body')).toBeUndefined()
  expect(reader.diagnostics.some(item => item.code === 'cfb-flat-directory-recovered')).toBe(false)
})

it('leaves detached records alone when the reachable graph has no broken root-level link', () => {
  const bytes = compoundFixture({ A: Uint8Array.of(65), Body: new Uint8Array(4096) })
  new DataView(bytes.buffer).setUint32(fixtureEntry(bytes, 'A') + 72, 0xffffffff, true)
  expect(openCompoundFile(bytes, limits, 'requested').readRootStream('Body')).toBeUndefined()
})

it('rejects duplicate names and shared allocation instead of picking a detached candidate', () => {
  const bytes = compoundFixture({ AA: new Uint8Array(4096), BB: new Uint8Array(4096) })
  const view = new DataView(bytes.buffer), a = fixtureEntry(bytes, 'AA'), b = fixtureEntry(bytes, 'BB')
  view.setUint32(a + 72, 0x7fffffff, true)
  view.setUint16(b, 65, true); view.setUint16(b + 2, 65, true)
  expect(() => openCompoundFile(bytes, limits, 'requested')).toThrow(/Duplicate/)
  view.setUint16(b, 66, true); view.setUint16(b + 2, 66, true)
  view.setUint32(b + 116, view.getUint32(a + 116, true), true)
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('AA')).toHaveLength(4096)
  expect(() => reader.readRootStream('BB')).toThrow(/shared/)
})

it.each(['root-type', 'flat-link'] as const)('converts validated Word text after %s recovery and preserves strict rejection', kind => {
  const bytes = compoundFixture(wordStreams([{ units: [65, 66, 13], unicode: false }]))
  const view = new DataView(bytes.buffer), root = fixtureEntry(bytes, 'Root Entry')
  if (kind === 'root-type') view.setUint8(root + 66, 0)
  else {
    const word = fixtureEntry(bytes, 'WordDocument'), directory = (view.getUint32(48, true) + 1) * 512
    view.setUint32(root + 76, (word - directory) / 128, true)
    view.setUint32(word + 72, 0x7fffffff, true)
  }
  const before = bytes.slice(), result = createDocxSourcePlan(bytes)
  expect(JSON.stringify(result.plan)).toContain('"children":["AB"]')
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow()
  expect(bytes).toEqual(before)
})
