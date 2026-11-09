import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../binary/limits'
import { inspectDoc } from '../inspection'
import { compoundFixture, fixtureEntry } from '../testing/compound'
import { wordStreams } from '../testing/word'
import { openCompoundFile } from './reader'

/** @param bytes - Independently constructed fixture with contiguous FAT sectors. @param sector - Described sector. @param value - Replacement FAT entry. */
function setFixtureFat(bytes: Uint8Array, sector: number, value: number): void {
  const view = new DataView(bytes.buffer)
  const size = 2 ** view.getUint16(30, true)
  view.setUint32(size + sector * 4, value, true)
}

describe('FAT self-marker compatibility with independent sector ownership', () => {
  it.each([3, 4] as const)('reads an ENDOFCHAIN FAT marker in v%s while retaining source bytes', version => {
    const content = new Uint8Array(4097).fill(0x61)
    const bytes = compoundFixture({ Text: content }, { version })
    setFixtureFat(bytes, 0, 0xfffffffe)
    const before = bytes.slice()
    const result = openCompoundFile(bytes, resolveLimits({}))
    expect(result.readRootStream('Text')).toEqual(content)
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'fat-sector-end-marker' })])
    expect(bytes).toEqual(before)
  })

  it('uses the same ownership rule for FAT locations in an extended DIFAT', () => {
    const bytes = compoundFixture({ Text: Uint8Array.of(7, 8) }, { extendedDifat: true })
    setFixtureFat(bytes, 0, 0xfffffffe)
    setFixtureFat(bytes, 109, 0xfffffffe)
    const result = openCompoundFile(bytes, resolveLimits({}))
    expect(result.readRootStream('Text')).toEqual(Uint8Array.of(7, 8))
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]?.message).toContain('2 FAT sectors')
  })

  it.each([0, 0xffffffff, 0xfffffffc])('rejects an unadmitted FAT self value %s', marker => {
    const bytes = compoundFixture({ Text: Uint8Array.of(7) })
    setFixtureFat(bytes, 0, marker)
    expect(() => openCompoundFile(bytes, resolveLimits({}))).toThrow(/ownership markers/u)
  })

  it.each(['directory', 'mini-fat', 'stream'] as const)('keeps a compatible FAT sector unavailable to the %s chain', owner => {
    const bytes = compoundFixture({ Text: new Uint8Array(4096), Small: Uint8Array.of(7) })
    const view = new DataView(bytes.buffer)
    setFixtureFat(bytes, 0, 0xfffffffe)
    if (owner === 'directory') view.setUint32(48, 0, true)
    else if (owner === 'mini-fat') view.setUint32(60, 0, true)
    else view.setUint32(fixtureEntry(bytes, 'Text') + 116, 0, true)
    expect(() => openCompoundFile(bytes, resolveLimits({}))).toThrow(/cyclic, shared, or out of bounds/u)
  })

  it('continues rejecting a DIFAT sector whose own marker is a chain terminator', () => {
    const bytes = compoundFixture({ Text: Uint8Array.of(7) }, { extendedDifat: true })
    const view = new DataView(bytes.buffer)
    setFixtureFat(bytes, view.getUint32(68, true), 0xfffffffe)
    expect(() => openCompoundFile(bytes, resolveLimits({}))).toThrow(/ownership markers/u)
  })

  it('surfaces the compatibility decision through the public DOC inspection', () => {
    const bytes = compoundFixture(wordStreams([{ units: [65, 13], unicode: false }]))
    setFixtureFat(bytes, 0, 0xfffffffe)
    const inspected = inspectDoc(bytes)
    expect(inspected.text).toBe('A\r')
    expect(inspected.diagnostics).toContainEqual(expect.objectContaining({ code: 'fat-sector-end-marker' }))
  })
})
