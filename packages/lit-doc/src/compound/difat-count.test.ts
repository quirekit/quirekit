import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../binary/limits'
import { compoundFixture } from '../testing/compound'
import { openCompoundFile } from './reader'

const limits = resolveLimits({})

describe('declared FAT position prefixes', () => {
  it.each([3, 4] as const)('ignores unused header entries in v%s and diagnoses their presence', version => {
    const bytes = compoundFixture({ Text: Uint8Array.of(65, 13) }, { version })
    const view = new DataView(bytes.buffer)
    view.setUint32(80, view.getUint32(48, true), true)
    view.setUint32(508, 0x70000000, true)
    const result = openCompoundFile(bytes, limits)
    expect(result.readRootStream('Text')).toEqual(Uint8Array.of(65, 13))
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-unused-difat-entries' }))
  })

  it.each([3, 4] as const)('uses only the declared extension prefix in v%s', version => {
    const bytes = compoundFixture({ Text: Uint8Array.of(65, 13) }, { version, extendedDifat: true })
    const view = new DataView(bytes.buffer), size = 2 ** view.getUint16(30, true)
    const offset = (view.getUint32(68, true) + 1) * size
    view.setUint32(offset + 4, 0, true)
    const result = openCompoundFile(bytes, limits)
    expect(result.readRootStream('Text')).toEqual(Uint8Array.of(65, 13))
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-unused-difat-entries' }))
  })

  it('keeps a missing used slot unresolved even when a later unused slot contains a FAT position', () => {
    const bytes = compoundFixture({ Text: Uint8Array.of(65) }, { extendedDifat: true })
    const view = new DataView(bytes.buffer)
    const offset = (view.getUint32(68, true) + 1) * 512
    view.setUint32(76, 0xffffffff, true)
    view.setUint32(offset + 4, 0, true)
    expect(() => openCompoundFile(bytes, limits)).toThrow(/DIFAT length/)
  })

  it('rejects duplicate used FAT positions', () => {
    const bytes = compoundFixture({ Text: Uint8Array.of(65) }, { extendedDifat: true })
    const view = new DataView(bytes.buffer)
    view.setUint32((view.getUint32(68, true) + 1) * 512, 0, true)
    expect(() => openCompoundFile(bytes, limits)).toThrow(/cyclic, shared/)
  })
})

describe('unused allocation pointers', () => {
  it('ignores both zero-count starting pointers without reading a sector', () => {
    const bytes = compoundFixture({ Large: new Uint8Array(4096).fill(0x63) })
    const view = new DataView(bytes.buffer)
    view.setUint32(60, 0xffffffff, true)
    view.setUint32(68, 0, true)
    const result = openCompoundFile(bytes, limits)
    expect(result.readRootStream('Large')).toEqual(new Uint8Array(4096).fill(0x63))
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-unused-allocation-pointer' }))
  })

  it('diagnoses an unused next pointer on the final declared extension page', () => {
    const bytes = compoundFixture({ Text: Uint8Array.of(65) }, { extendedDifat: true })
    const view = new DataView(bytes.buffer), page = view.getUint32(68, true)
    view.setUint32((page + 2) * 512 - 4, page, true)
    const result = openCompoundFile(bytes, limits)
    expect(result.readRootStream('Text')).toEqual(Uint8Array.of(65))
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-unused-allocation-pointer' }))
    view.setUint32(72, 2, true)
    expect(() => openCompoundFile(bytes, limits)).toThrow(/cyclic, shared/)
  })
})
