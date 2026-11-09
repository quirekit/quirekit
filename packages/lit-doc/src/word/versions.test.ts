import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../inspection'
import { compoundFixture } from '../testing/compound'
import { wordStreams } from '../testing/word'
import { readWordHeader } from './fib'
import { resolveLimits } from '../binary/limits'

/**
 * Relocates complete FIB regions using independent count fields and opaque tails.
 * @param counts - Word, double-word, locator and extension counts.
 * @returns Source streams retaining the original text and CLX locations.
 */
function countedStreams(counts: readonly number[]): Record<string, Uint8Array> {
  const streams = wordStreams([{ units: [65, 13], unicode: false }], { version: 0x10c })
  const word = streams.WordDocument!
  const original = word.slice()
  const view = new DataView(word.buffer)
  const regions = [original.subarray(34, 62), original.subarray(64, 152),
    original.subarray(154, 1466), original.subarray(1468, 1472)]
  let position = 32
  for (let index = 0; index < counts.length; index++) {
    const length = counts[index]! * [2, 4, 8, 2][index]!
    view.setUint16(position, counts[index]!, true)
    word.fill(0xa5, position + 2, position + 2 + length)
    word.set(regions[index]!.subarray(0, length), position + 2)
    position += 2 + length
  }
  return streams
}

describe('known Word 97 version aliases', () => {
  it.each([0xc0, 0xc2, 0xc3])('reads version %i with the Word 97 field layout', (version) => {
    const streams = wordStreams([{ units: [65, 13], unicode: false }])
    new DataView(streams.WordDocument!.buffer).setUint16(2, version, true)
    const result = inspectDoc(compoundFixture(streams))
    expect(result.version).toBe(version)
    expect(result.text).toBe('A\r')
    expect(result.diagnostics).toEqual([])
  })

  it.each([0xc2, 0xc3])('uses the newer version when base version %i is an alias', version => {
    const streams = wordStreams([{ units: [0x05d0, 13], unicode: true }], { version: 0xd9 })
    new DataView(streams.WordDocument!.buffer).setUint16(2, version, true)
    const result = inspectDoc(compoundFixture(streams))
    expect(result.version).toBe(0xd9)
    expect(result.text).toBe('\u05d0\r')
  })

  it('does not generalize aliases to unknown versions or inconsistent field counts', () => {
    const streams = wordStreams([{ units: [65, 13], unicode: false }])
    const view = new DataView(streams.WordDocument!.buffer)
    view.setUint16(2, 0xc4, true)
    expect(() => inspectDoc(compoundFixture(streams))).toThrow(expect.objectContaining({ code: 'unsupported-version' }))
    view.setUint16(2, 0xc2, true)
    view.setUint16(152, 92, true)
    expect(() => inspectDoc(compoundFixture(streams))).toThrow(expect.objectContaining({ code: 'invalid-fib' }))
  })

  it.each([93, 108])('reads an effective 0xC3 extension after %i physical locators', records => {
    const streams = wordStreams([{ units: [65, 13], unicode: false }])
    const view = new DataView(streams.WordDocument!.buffer)
    view.setUint16(152, records, true)
    const extension = 154 + records * 8
    view.setUint16(extension, 4, true)
    view.setUint16(extension + 2, 0xc3, true)
    view.setUint16(extension + 6, 0xa5a5, true)
    const result = inspectDoc(compoundFixture(streams))
    expect(result.version).toBe(0xc3)
    expect(result.text).toBe('A\r')
    expect(result.diagnostics.map(item => item.code)).toEqual(['extended-fib-regions'])
    expect(readWordHeader(streams.WordDocument!, resolveLimits({})).records).toHaveLength(93)
    view.setUint16(extension + 2, 0xc4, true)
    expect(() => inspectDoc(compoundFixture(streams)))
      .toThrow(expect.objectContaining({ code: 'unsupported-version' }))
  })

  it('requires the complete known prefix when the effective version is 0xC3', () => {
    const streams = wordStreams([{ units: [65, 13], unicode: false }])
    const view = new DataView(streams.WordDocument!.buffer)
    view.setUint16(152, 92, true)
    const extension = 154 + 92 * 8
    view.setUint16(extension, 4, true)
    view.setUint16(extension + 2, 0xc3, true)
    expect(() => inspectDoc(compoundFixture(streams)))
      .toThrow(expect.objectContaining({ code: 'invalid-fib' }))
  })
})

describe('counted FIB extension regions', () => {
  it.each([
    [15, 22, 164, 2], [14, 23, 164, 2], [14, 22, 183, 2],
    [14, 22, 164, 7], [15, 23, 183, 7],
  ])('reads known prefixes with counts %j', (...counts) => {
    const streams = countedStreams(counts)
    const result = inspectDoc(compoundFixture(streams))
    expect(result.version).toBe(0x10c)
    expect(result.text).toBe('A\r')
    expect(result.diagnostics.map(item => item.code)).toEqual(['extended-fib-regions'])
    expect(readWordHeader(streams.WordDocument!, resolveLimits({})).records).toHaveLength(164)
  })

  it.each([
    [13, 22, 164, 2], [14, 21, 164, 2], [14, 22, 163, 2], [14, 22, 164, 1],
  ])('rejects an incomplete known prefix with counts %j', (...counts) => {
    expect(() => inspectDoc(compoundFixture(countedStreams(counts))))
      .toThrow(expect.objectContaining({ code: 'invalid-fib' }))
  })

  it('rejects truncated extension tails and headers past the meaningful stream', () => {
    const streams = countedStreams([14, 22, 183, 7])
    const word = streams.WordDocument!
    const headerLength = 154 + 183 * 8 + 2 + 14
    expect(() => readWordHeader(word.subarray(0, headerLength - 1), resolveLimits({})))
      .toThrow(expect.objectContaining({ code: 'invalid-fib' }))
    new DataView(word.buffer).setUint32(64, headerLength - 1, true)
    expect(() => inspectDoc(compoundFixture(streams))).toThrow(expect.objectContaining({ code: 'invalid-fib' }))
  })

  it('keeps the missing-extension diagnostic alongside an extended locator table', () => {
    const streams = countedStreams([14, 22, 183, 0])
    new DataView(streams.WordDocument!.buffer).setUint16(2, 0x10c, true)
    expect(inspectDoc(compoundFixture(streams)).diagnostics.map(item => item.code))
      .toEqual(['missing-fib-version-extension', 'extended-fib-regions'])
  })

  it('rejects unknown effective versions even when the known prefix is complete', () => {
    const streams = countedStreams([14, 22, 183, 7])
    new DataView(streams.WordDocument!.buffer).setUint16(156 + 183 * 8, 0x113, true)
    expect(() => inspectDoc(compoundFixture(streams))).toThrow(expect.objectContaining({ code: 'unsupported-version' }))
  })
})
