import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../binary/limits'
import { DocReadError } from '../errors'
import { inspectDoc } from '../inspection'
import { compoundFixture } from '../testing/compound'
import { wordStreams } from '../testing/word'
import { readWordHeader } from './fib'
import { readTextStorage } from './pieces'

describe('text storage boundaries', () => {
  it('retains uninterpreted property groups and validates their piece references', () => {
    const streams = wordStreams([{ units: [65, 13], unicode: false }])
    const group = Uint8Array.of(1, 3, 0, 0x35, 8, 1)
    const table = new Uint8Array(group.length + streams['1Table']!.length)
    table.set(group); table.set(streams['1Table']!, group.length)
    const view = new DataView(table.buffer)
    view.setUint16(group.length + 19, 1, true)
    new DataView(streams.WordDocument!.buffer).setUint32(154 + 33 * 8 + 4, table.length, true)
    const limits = resolveLimits({})
    const header = readWordHeader(streams.WordDocument!, limits)
    const source = readTextStorage(streams.WordDocument!, table, header, limits)
    expect(source.text).toBe('A\r')
    expect(source.propertyGroups).toEqual([Uint8Array.of(0x35, 8, 1)])
    expect(source.pieces[0]!.propertyModifier).toBe(1)
    view.setUint16(group.length + 19, 3, true)
    expect(() => readTextStorage(streams.WordDocument!, table, header, limits)).toThrow(/property reference/)
  })

  it('ignores the reserved FC bit without changing source positions', () => {
    const streams = wordStreams([{ units: [65, 13], unicode: false }])
    const view = new DataView(streams['1Table']!.buffer)
    view.setUint32(15, view.getUint32(15, true) | 0x80000000, true)
    expect(inspectDoc(compoundFixture(streams)).text).toBe('A\r')
  })

  it('rejects missing selected table streams and piece-budget excess', () => {
    const streams = wordStreams([{ units: [65], unicode: false }, { units: [13], unicode: true }])
    expect(() => inspectDoc(compoundFixture(streams), { limits: { maxPieces: 1 } })).toThrow(/limit/)
    streams['0Table'] = streams['1Table']!
    delete streams['1Table']
    expect(() => inspectDoc(compoundFixture(streams))).toThrow(/Selected 1Table/)
  })

  it('rejects every truncated prefix with a bounded library error', () => {
    const bytes = compoundFixture(wordStreams([{ units: [65, 13], unicode: false }]))
    for (let length = 0; length < bytes.length; length++) {
      expect(() => inspectDoc(bytes.subarray(0, length))).toThrow(DocReadError)
    }
  })
})
