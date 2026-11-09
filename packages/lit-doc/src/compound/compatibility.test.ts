import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../inspection'
import { compoundFixture, fixtureEntry } from '../testing/compound'
import { wordStreams } from '../testing/word'

describe('bounded root-label compatibility', () => {
  it('diagnoses a case variant while preserving root and embedded stream identity checks', () => {
    const bytes = compoundFixture(wordStreams([{ units: [65, 13], unicode: false }]))
    const root = fixtureEntry(bytes, 'Root Entry')
    const view = new DataView(bytes.buffer)
    for (let index = 0; index < 10; index++) view.setUint16(root + index * 2, 'root entry'.charCodeAt(index), true)
    const result = inspectDoc(bytes)
    expect(result.text).toBe('A\r')
    expect(result.diagnostics.map((item) => item.code)).toEqual(['root-name-case-variant'])
    view.setUint32(root + 72, 1, true)
    expect(() => inspectDoc(bytes)).toThrow(/siblings/)
  })

  it('ignores a different root label while direct stream identities remain canonical', () => {
    const bytes = compoundFixture(wordStreams([{ units: [65, 13], unicode: false }]))
    new DataView(bytes.buffer).setUint16(fixtureEntry(bytes, 'Root Entry'), 88, true)
    expect(inspectDoc(bytes)).toMatchObject({ text: 'A\r', diagnostics: [{ code: 'root-label-ignored' }] })
  })

  it('accepts a bounded nonterminated root label but rejects the same condition on a real stream', () => {
    const bytes = compoundFixture(wordStreams([{ units: [65, 13], unicode: false }]))
    const view = new DataView(bytes.buffer)
    view.setUint16(fixtureEntry(bytes, 'Root Entry') + 20, 92, true)
    expect(inspectDoc(bytes).diagnostics).toContainEqual(expect.objectContaining({ code: 'root-label-ignored' }))
    view.setUint16(fixtureEntry(bytes, 'WordDocument') + 24, 92, true)
    expect(() => inspectDoc(bytes)).toThrow(/name length or terminator/)
  })

  it.each([0, 1, 3, 66, 0xffff])('keeps the root name-buffer length bounded at %i', length => {
    const bytes = compoundFixture(wordStreams([{ units: [65, 13], unicode: false }]))
    new DataView(bytes.buffer).setUint16(fixtureEntry(bytes, 'Root Entry') + 64, length, true)
    expect(() => inspectDoc(bytes)).toThrow(/name length or terminator/)
  })
})
