import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../binary/limits'
import { compoundFixture, fixtureEntry } from '../testing/compound'
import { openCompoundFile } from './reader'

const limits = resolveLimits({})

describe('compound stream ownership and bounds', () => {
  it.each([3, 4] as const)('reads normal and mini streams in CFB v%s', (version) => {
    const small = Uint8Array.of(0, 1, 2, 255)
    const large = new Uint8Array(4097).fill(0x63)
    const bytes = compoundFixture({ Small: small, Large: large, Empty: new Uint8Array() }, { version })
    const wrapped = new Uint8Array(bytes.length + 19)
    wrapped.set(bytes, 11)
    const container = openCompoundFile(wrapped.subarray(11, 11 + bytes.length), limits)
    expect(container.version).toBe(version)
    expect(container.readRootStream('small')).toEqual(small)
    expect(container.readRootStream('Large')).toEqual(large)
    expect(container.readRootStream('Empty')).toEqual(new Uint8Array())
  })

  it('reads FAT locations beyond the 109 header entries', () => {
    const bytes = compoundFixture({ Text: Uint8Array.of(7, 8) }, { extendedDifat: true })
    expect(openCompoundFile(bytes, limits).readRootStream('Text')).toEqual(Uint8Array.of(7, 8))
  })

  it('ignores the historical high size word only in v3', () => {
    for (const version of [3, 4] as const) {
      const bytes = compoundFixture({ Text: Uint8Array.of(7) }, { version })
      new DataView(bytes.buffer).setUint32(fixtureEntry(bytes, 'Text') + 124, 0xffffffff, true)
      if (version === 3) expect(openCompoundFile(bytes, limits).readRootStream('Text')).toEqual(Uint8Array.of(7))
      else expect(() => openCompoundFile(bytes, limits)).toThrow()
    }
  })

  it('rejects a directory cycle before looking up any stream', () => {
    const bytes = compoundFixture({ Text: Uint8Array.of(7) })
    new DataView(bytes.buffer).setUint32(fixtureEntry(bytes, 'Text') + 72, 1, true)
    expect(() => openCompoundFile(bytes, limits)).toThrow(/directory/i)
  })

  it('rejects cycles, shared sectors and short allocation chains', () => {
    for (const corruption of ['cycle', 'shared', 'short']) {
      const bytes = compoundFixture({ First: new Uint8Array(4096), Second: new Uint8Array(4096) })
      const view = new DataView(bytes.buffer)
      const first = fixtureEntry(bytes, 'First')
      const sector = view.getUint32(first + 116, true)
      if (corruption === 'shared') view.setUint32(fixtureEntry(bytes, 'Second') + 116, sector, true)
      else view.setUint32(512 + sector * 4, corruption === 'cycle' ? sector : 0xfffffffe, true)
      expect(() => openCompoundFile(bytes, limits)).toThrow()
    }
  })

  it('rejects a mini-stream chain that leaves the root mini stream', () => {
    const bytes = compoundFixture({ Text: new Uint8Array(128) })
    const view = new DataView(bytes.buffer)
    view.setUint32((view.getUint32(60, true) + 1) * 512, 100, true)
    expect(() => openCompoundFile(bytes, limits)).toThrow()
  })

  it('enforces directory allocation limits before materializing records', () => {
    const bytes = compoundFixture({ Text: Uint8Array.of(7) })
    expect(() => openCompoundFile(bytes, { ...limits, maxDirectoryEntries: 1 })).toThrow(/limit/i)
  })

  it('does not mistake a nested stream for a root WordDocument', () => {
    const bytes = compoundFixture({ Folder: new Uint8Array(), WordDocument: Uint8Array.of(7) })
    const view = new DataView(bytes.buffer)
    const folder = fixtureEntry(bytes, 'Folder')
    view.setUint8(folder + 66, 1)
    view.setUint32(folder + 72, 0xffffffff, true)
    view.setUint32(folder + 76, 2, true)
    view.setUint32(folder + 116, 0, true)
    expect(openCompoundFile(bytes, limits).readRootStream('WordDocument')).toBeUndefined()
  })
})
