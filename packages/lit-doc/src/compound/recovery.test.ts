import { expect, it } from 'vitest'
import { resolveLimits } from '../binary/limits'
import { compoundFixture, fixtureEntry } from '../testing/compound'
import { openCompoundFile } from './reader'
import { readDirectory } from './directory'
import { ByteView } from '../binary/bytes'
import { readAllocation } from './allocation'
import { readHeader } from './header'

const limits = resolveLimits({})

it('preserves existing root-label diagnostics when the label contains legacy path characters', () => {
  const bytes = compoundFixture({ Body: new Uint8Array(4096) }), view = new DataView(bytes.buffer)
  const root = fixtureEntry(bytes, 'Root Entry'), label = 'C:\\legacy'
  for (let index = 0; index <= label.length; index++) view.setUint16(root + index * 2, index < label.length ? label.charCodeAt(index) : 0, true)
  view.setUint16(root + 64, (label.length + 1) * 2, true)
  for (const mode of ['all', 'requested'] as const)
    expect(openCompoundFile(bytes, limits, mode).diagnostics.map(item => item.code)).toEqual(['root-label-ignored'])
})

it('retains logical FAT page positions when an intermediate declared position is missing', () => {
  const bytes = new Uint8Array(301 * 512), seed = compoundFixture({ Body: new Uint8Array(4096) })
  bytes.set(seed)
  const view = new DataView(bytes.buffer)
  view.setUint32(44, 3, true); view.setUint32(80, 0xffffffff, true); view.setUint32(84, 2, true)
  view.setUint32(3 * 512, 0xfffffffe, true)
  const input = new ByteView(bytes, 'invalid-cfb'), header = readHeader(input, limits, [], true)
  expect(() => readAllocation(input, header)).toThrow(/DIFAT length/)
  const storage = readAllocation(input, header, true)
  expect(storage.fat[128]).toBe(0xffffffff)
  expect(storage.fat[256]).toBe(0xfffffffe)
  expect(storage.claimed[2]).toBe(1)
})

it.each([3, 4] as const)('reads complete requested bytes despite a dangling declared tail in v%s', version => {
  const expected = new Uint8Array(4096).fill(65)
  const bytes = compoundFixture({ Body: expected }, { version })
  const view = new DataView(bytes.buffer), size = version === 3 ? 512 : 4096
  const start = view.getUint32(fixtureEntry(bytes, 'Body') + 116, true)
  view.setUint32(size + (start + 4096 / size - 1) * 4, 0x12345678, true)
  expect(() => openCompoundFile(bytes, limits)).toThrow()
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('Body')).toEqual(expected)
  expect(reader.readRootStream('BODY')).toEqual(expected)
  expect(reader.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-chain-tail-ignored' }))
})

it('retains actual stream prefixes without fabricating missing bytes', () => {
  const bytes = compoundFixture({ Body: new Uint8Array(8192).fill(66) })
  const view = new DataView(bytes.buffer), start = view.getUint32(fixtureEntry(bytes, 'Body') + 116, true)
  view.setUint32(512 + start * 4, 0xfffffffe, true)
  expect(() => openCompoundFile(bytes, limits)).toThrow(/shorter/)
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('Body')).toEqual(new Uint8Array(512).fill(66))
  expect(reader.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-stream-truncated' }))
})

it('bounds a stale FAT count by real declared DIFAT locations', () => {
  const expected = new Uint8Array(4096).fill(67), bytes = compoundFixture({ Body: expected })
  const view = new DataView(bytes.buffer)
  view.setUint32(40, 77, true); view.setUint32(44, 0x20202020, true)
  view.setUint32(72, 0x20202020, true)
  expect(() => openCompoundFile(bytes, limits)).toThrow(/counts/)
  expect(openCompoundFile(bytes, limits, 'requested').readRootStream('Body')).toEqual(expected)
})

it('skips invalid directory links and types while retaining root membership', () => {
  const expected = new Uint8Array(4096).fill(68)
  const bytes = compoundFixture({ Body: expected, Unused: new Uint8Array(4096) })
  const view = new DataView(bytes.buffer), bad = fixtureEntry(bytes, 'Unused')
  view.setUint8(bad + 66, 0)
  view.setUint32(bad + 72, 0xffffabcd, true)
  expect(() => openCompoundFile(bytes, limits)).toThrow()
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('Body')).toEqual(expected)
  expect(reader.readRootStream('Unused')).toBeUndefined()
  expect(reader.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-directory-recovered' }))
})

it('keeps metadata exclusive even when its self marker is corrupt', () => {
  const bytes = compoundFixture({ Body: new Uint8Array(4096) }), view = new DataView(bytes.buffer)
  view.setUint32(512, 0xffffffff, true)
  expect(() => openCompoundFile(bytes, limits)).toThrow(/markers/)
  expect(openCompoundFile(bytes, limits, 'requested').readRootStream('Body')).toHaveLength(4096)
  view.setUint32(fixtureEntry(bytes, 'Body') + 116, 0, true)
  expect(() => openCompoundFile(bytes, limits, 'requested').readRootStream('Body')).toThrow(/shared/)
})

it.each([1, 2, 3, 4, 5])('interprets only actual v3 directory fields when the final slot lacks %s bytes', missing => {
  const expected = new Uint8Array(4096).fill(69)
  const original = compoundFixture({ A: Uint8Array.of(1), B: Uint8Array.of(2), Body: expected })
  const bytes = new Uint8Array(original.length + 512 - missing)
  bytes.set(original)
  const view = new DataView(bytes.buffer), previous = view.getUint32(48, true)
  const directory = original.length / 512 - 1
  bytes.set(original.subarray((previous + 1) * 512, (previous + 2) * 512 - missing), original.length)
  view.setUint32(48, directory, true)
  view.setUint32(512 + directory * 4, 0xfffffffe, true)
  expect(() => openCompoundFile(bytes, limits)).toThrow()
  const reader = openCompoundFile(bytes, limits, 'requested')
  expect(reader.readRootStream('Body')).toEqual(missing <= 4 ? expected : undefined)
})

it.each([1, 2, 3, 4])('requires the complete v4 size word when the final slot lacks %s bytes', missing => {
  const bytes = compoundFixture({ A: Uint8Array.of(1), B: Uint8Array.of(2), Body: new Uint8Array(4096) }, { version: 4 })
  const directory = (new DataView(bytes.buffer).getUint32(48, true) + 1) * 4096
  const members = readDirectory(bytes.subarray(directory, directory + 512 - missing), 4, bytes.length, 'requested')
  expect(members.some(member => member.name === 'Body')).toBe(false)
})
