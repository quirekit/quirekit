import { expect, it } from 'vitest'
import { ByteView } from '../binary/bytes'
import { resolveLimits } from '../binary/limits'
import { compoundFixture, fixtureEntry } from '../testing/compound'
import { readAllocation, walkChain } from './allocation'
import { readHeader } from './header'
import { readMiniStorage } from './mini'
import { createStreamReader } from './streams'
import { openCompoundFile } from './reader'

const limits = resolveLimits({})

it.each([3, 4] as const)('keeps required normal bytes after an unused chain fails in v%s', version => {
  const expected = new Uint8Array(4096).fill(42)
  const bytes = compoundFixture({ Good: expected, Bad: new Uint8Array(4096) }, { version })
  new DataView(bytes.buffer).setUint32(fixtureEntry(bytes, 'Bad') + 116, 0xffffffff, true)
  expect(() => openCompoundFile(bytes, limits)).toThrow(expect.objectContaining({ code: 'invalid-cfb' }))
  const reader = openCompoundFile(bytes, limits, 'requested')
  const first = reader.readRootStream('Good')!
  expect(first).toEqual(expected)
  first.fill(1)
  expect(reader.readRootStream('GOOD')).toEqual(expected)
  expect(reader.auditUnrequestedStreams()).toEqual([expect.objectContaining({ code: 'cfb-unreadable-streams-omitted' })])
  expect(reader.auditUnrequestedStreams()).toEqual(reader.auditUnrequestedStreams())
  expect(reader.readRootStream('Good')).toEqual(expected)
})

it('defers stream sizes and skips bounded repeated directory edges', () => {
  const bytes = compoundFixture({ Good: new Uint8Array(4096), Bad: Uint8Array.of(7) })
  const view = new DataView(bytes.buffer), bad = fixtureEntry(bytes, 'Bad')
  view.setUint32(bad + 120, bytes.length + 1, true)
  expect(() => openCompoundFile(bytes, limits)).toThrow(/size exceeds/)
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('Good')).toHaveLength(4096)
  for (let attempt = 0; attempt < 2; attempt++) expect(() => reader.readRootStream('Bad')).toThrow(/shared/)
  view.setUint32(fixtureEntry(bytes, 'Good') + 72, 1, true)
  const recovered = openCompoundFile(bytes, limits, 'requested')
  expect(recovered.readRootStream('Good')).toHaveLength(4096)
  expect(recovered.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-directory-recovered' }))
})

it.each([3, 4] as const)('isolates unavailable miniature storage from a required normal stream in v%s', version => {
  const expected = new Uint8Array(4096).fill(65)
  const bytes = compoundFixture({ Good: expected, Small: Uint8Array.of(7) }, { version })
  const view = new DataView(bytes.buffer)
  view.setUint32(60, 0, true)
  expect(() => openCompoundFile(bytes, limits)).toThrow(/shared/)
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('Good')).toEqual(expected)
  for (let attempt = 0; attempt < 2; attempt++) expect(() => reader.readRootStream('Small')).toThrow(/shared/)
  expect(reader.auditUnrequestedStreams()).toEqual([expect.objectContaining({ code: 'cfb-unreadable-streams-omitted' })])
  expect(reader.readRootStream('Good')).toEqual(expected)
})

it('rolls back failed chain prefixes before a valid request acquires those units', () => {
  const expected = new Uint8Array(8192).fill(73)
  const bytes = compoundFixture({ Good: expected, Bad: new Uint8Array(4096) })
  const view = new DataView(bytes.buffer)
  view.setUint32(fixtureEntry(bytes, 'Bad') + 116, view.getUint32(fixtureEntry(bytes, 'Good') + 116, true), true)
  const input = new ByteView(bytes, 'invalid-cfb')
  const storage = readAllocation(input, readHeader(input, limits, []))
  const bad = { id: 1, parent: 0, type: 2, name: 'Bad', size: 4096, start: view.getUint32(fixtureEntry(bytes, 'Bad') + 116, true) }
  const reader = createStreamReader(storage, [])
  for (let attempt = 0; attempt < 2; attempt++) expect(() => reader.read(bad)).toThrow(/longer than declared/)
  expect(reader.read({ ...bad, id: 2, name: 'Good', size: 8192 })).toEqual(expected)
  const claimed = new Uint8Array(3)
  expect(() => walkChain(Uint32Array.of(1, 1, 0xfffffffe), claimed, 0, undefined, 3)).toThrow(/cyclic/)
  expect(claimed).toEqual(new Uint8Array(3))
})

it('rolls back physical mini claims when actual root payload copying fails', () => {
  const complete = compoundFixture({ Small: new Uint8Array(512) })
  const bytes = complete.subarray(0, complete.length - 1), input = new ByteView(bytes, 'invalid-cfb')
  const storage = readAllocation(input, readHeader(input, limits, []))
  const offset = fixtureEntry(complete, 'Root Entry'), view = new DataView(complete.buffer)
  const before = storage.claimed.slice()
  expect(() => readMiniStorage(storage, { id: 0, parent: -1, type: 5, name: 'Root Entry',
    start: view.getUint32(offset + 116, true), size: 512 })).toThrow(/exceeds stream length/)
  expect(storage.claimed).toEqual(before)
})

it('keeps requested ownership, metadata exclusion and resource ceilings explicit', () => {
  const bytes = compoundFixture({ Good: new Uint8Array(4096), Alias: new Uint8Array(4096) })
  const view = new DataView(bytes.buffer)
  view.setUint32(fixtureEntry(bytes, 'Alias') + 116, view.getUint32(fixtureEntry(bytes, 'Good') + 116, true), true)
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('Good')).toHaveLength(4096)
  expect(() => reader.readRootStream('Alias')).toThrow(/shared/)
  view.setUint32(fixtureEntry(bytes, 'Good') + 116, 0, true)
  expect(() => openCompoundFile(bytes, limits, 'requested').readRootStream('Good')).toThrow(/shared/)
  expect(() => openCompoundFile(bytes, { ...limits, maxDirectoryEntries: 1 }, 'requested')).toThrow(/limit/)
})
