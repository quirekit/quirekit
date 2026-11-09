import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveLimits } from '../binary/limits'
import { compoundFixture, fixtureEntry } from '../testing/compound'
import { createDocxSourcePlan } from '../conversion/plan'
import { openCompoundFile } from './reader'

const limits = resolveLimits({})

describe('fixed compound header fields', () => {
  it('attributes container compatibility decisions to their actual source in conversion', () => {
    const original = new Uint8Array(readFileSync(new URL('../testing/fixtures/word-mac/chinese-basic.doc', import.meta.url)))
    const bytes = new Uint8Array(original.length + 1); bytes.set(original); bytes[8] = 7
    const { report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    for (const code of ['cfb-header-constants', 'cfb-partial-last-sector']) {
      expect(report.diagnostics).toContainEqual(expect.objectContaining({ code, kind: 'compatibility', source: 'container' }))
    }
  })

  it.each([3, 4] as const)('uses the v%s layout when fixed hints contain legacy values', version => {
    const bytes = compoundFixture({ Text: Uint8Array.of(65, 13) }, { version })
    const view = new DataView(bytes.buffer)
    view.setUint16(28, 0xff20, true)
    view.setUint16(32, 14, true)
    view.setUint32(56, 0x20202020, true)
    bytes[8] = 7
    bytes[34] = 8
    if (version === 4) bytes[600] = 9
    const before = bytes.slice()
    const result = openCompoundFile(bytes, limits)
    expect(result.readRootStream('Text')).toEqual(Uint8Array.of(65, 13))
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-header-constants' }))
    expect(bytes).toEqual(before)
  })

  it('keeps sector geometry, metadata ownership and input limits authoritative', () => {
    const bytes = compoundFixture({ Text: new Uint8Array(4096) })
    const view = new DataView(bytes.buffer)
    bytes[8] = 7
    view.setUint16(30, 8, true)
    expect(() => openCompoundFile(bytes, limits)).toThrow(/sector geometry/)
    view.setUint16(30, 9, true)
    view.setUint32(fixtureEntry(bytes, 'Text') + 116, 0, true)
    expect(() => openCompoundFile(bytes, limits)).toThrow(/cyclic, shared/)
    expect(() => openCompoundFile(bytes, { ...limits, maxInputBytes: bytes.length - 1 })).toThrow(/Input byte limit/)
  })
})

describe('physical final-sector bounds', () => {
  it.each([3, 4] as const)('reads all meaningful bytes without final-sector padding in v%s', version => {
    const payload = new Uint8Array(4200).fill(0x63)
    const bytes = compoundFixture({ Payload: payload }, { version })
    const size = version === 3 ? 512 : 4096
    const view = new DataView(bytes.buffer)
    const start = view.getUint32(fixtureEntry(bytes, 'Payload') + 116, true)
    const meaningfulEnd = (start + 1) * size + payload.length
    const actual = bytes.subarray(0, meaningfulEnd)
    const result = openCompoundFile(actual, limits)
    expect(result.readRootStream('Payload')).toEqual(payload)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'cfb-partial-last-sector' }))
    expect(() => openCompoundFile(bytes.subarray(0, meaningfulEnd - 1), limits).readRootStream('Payload'))
      .toThrow(/Byte range/)
  })

  it.each([3, 4] as const)('ignores an unallocated trailing byte through the same v%s bounds', version => {
    const payload = new Uint8Array(4097).fill(0x42)
    const original = compoundFixture({ Payload: payload }, { version })
    const wrapped = new Uint8Array(original.length + 13)
    wrapped.set(original, 7)
    wrapped[7 + original.length] = 0xee
    const input = wrapped.subarray(7, 8 + original.length)
    const before = input.slice()
    expect(openCompoundFile(input, limits).readRootStream('Payload')).toEqual(payload)
    expect(input).toEqual(before)
  })

  it('rejects a chain targeting a sector without any physical byte', () => {
    const bytes = compoundFixture({ Payload: new Uint8Array(4200) })
    const view = new DataView(bytes.buffer)
    const entry = fixtureEntry(bytes, 'Payload')
    const start = view.getUint32(entry + 116, true)
    view.setUint32(512 + start * 4, bytes.length / 512 - 1, true)
    expect(() => openCompoundFile(bytes, limits)).toThrow(/out of bounds/)
  })
})
