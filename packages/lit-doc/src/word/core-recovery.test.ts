import { expect, it } from 'vitest'
import { resolveLimits } from '../binary/limits'
import { compoundFixture } from '../testing/compound'
import { wordStreams } from '../testing/word'
import { createDocxSourcePlan } from '../conversion/plan'
import { readWordHeader } from './fib'
import { readTextStorage } from './pieces'

const limits = resolveLimits({})

it('uses actual WordDocument bytes when cbMac is zero', () => {
  const streams = wordStreams([{ units: [65, 66, 13], unicode: false }])
  new DataView(streams.WordDocument!.buffer).setUint32(64, 0, true)
  expect(() => readWordHeader(streams.WordDocument!, limits)).toThrow(/Meaningful/)
  const header = readWordHeader(streams.WordDocument!, limits, true)
  expect(readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits, true).text).toBe('AB\r')
  expect(header.diagnostics).toContainEqual(expect.objectContaining({ code: 'fib-length-hint-ignored' }))
})

it('retains a known effective version with a shorter actual locator prefix', () => {
  const streams = wordStreams([{ units: [65, 13], unicode: false }], { version: 0x10c })
  const view = new DataView(streams.WordDocument!.buffer)
  view.setUint16(154 + 164 * 8, 5, true)
  view.setUint16(156 + 164 * 8, 0x112, true)
  expect(() => readWordHeader(streams.WordDocument!, limits)).toThrow(/lengths/)
  const actual = createDocxSourcePlan(compoundFixture(streams))
  expect(actual.report.recovery?.cause).toBe('invalid-fib')
  expect(JSON.stringify(actual.plan)).toContain('"children":["A"]')
})

it('stops at the first descending CP without sorting subsequent pieces into the body', () => {
  const streams = wordStreams([{ units: [65, 66], unicode: false }, { units: [67, 68], unicode: false }, { units: [69, 13], unicode: false }])
  new DataView(streams['1Table']!.buffer).setUint32(13, 1, true)
  const header = readWordHeader(streams.WordDocument!, limits)
  expect(() => readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits)).toThrow()
  const actual = readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits, true)
  expect(actual.text).toBe('AB')
  expect(actual.recoveredRange).toEqual({ kind: 'main', start: 0, end: 2 })
  expect(createDocxSourcePlan(compoundFixture(streams)).report.diagnostics).toContainEqual(expect.objectContaining({
    code: 'text-recovery-main-story-incomplete', kind: 'loss', start: 0, end: 2,
  }))
})

it('retains original CPs for a field-free suffix without padding missing characters', () => {
  const streams = wordStreams([{ units: [65, 66, 13], unicode: false }], { storyLengths: [6, 0, 0, 0, 0, 0, 0] })
  const table = new DataView(streams['1Table']!.buffer)
  table.setUint32(5, 3, true); table.setUint32(9, 6, true)
  const header = readWordHeader(streams.WordDocument!, limits)
  const actual = readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits, true)
  expect(actual.text).toBe('AB\r')
  expect(actual.recoveredRange).toEqual({ kind: 'main', start: 3, end: 6 })
  const product = createDocxSourcePlan(compoundFixture(streams))
  expect(product.report.recovery?.cause).toBe('invalid-text-map')
  expect(JSON.stringify(product.plan)).toContain('"children":["AB"]')
  new DataView(streams.WordDocument!.buffer).setUint32(154 + 16 * 8 + 4, 10, true)
  expect(() => createDocxSourcePlan(compoundFixture(streams))).toThrow(/field visibility/)
})

it('bounds malformed piece endpoints by actual bytes and declared Story length', () => {
  const streams = wordStreams([{ units: [65, 66, 13], unicode: false }])
  new DataView(streams['1Table']!.buffer).setUint32(9, 0x7fffffff, true)
  const header = readWordHeader(streams.WordDocument!, limits)
  const actual = readTextStorage(streams.WordDocument!, streams['1Table']!, header, limits, true)
  expect(actual.text).toBe('AB\r')
  expect(actual.recoveredRange?.end).toBe(3)
  expect(() => createDocxSourcePlan(compoundFixture(streams), { limits: { maxTextCodeUnits: 2 } })).toThrow(/limit/)
})

it('returns actual Unicode code units when a physical tail ends halfway through a character', () => {
  const streams = wordStreams([{ units: [65, 66, 13], unicode: true }])
  const word = streams.WordDocument!.subarray(0, 2053)
  const header = readWordHeader(word, limits, true)
  const actual = readTextStorage(word, streams['1Table']!, header, limits, true)
  expect(actual.text).toBe('AB')
  expect(actual.recoveredRange?.end).toBe(2)
})
