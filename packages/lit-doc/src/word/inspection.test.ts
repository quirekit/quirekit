import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../inspection'
import { compoundFixture } from '../testing/compound'
import { wordStreams } from '../testing/word'

describe('DOC source text and FIB admission', () => {
  it('preserves BOM, surrogate pairs, lone surrogates and paragraph controls as UTF-16 units', () => {
    const units = [0xfeff, 0x4e2d, 0xd83d, 0xde00, 0xd800, 13]
    const result = inspectDoc(compoundFixture(wordStreams([{ units, unicode: true }])))
    expect(result.scope).toBe('text-storage')
    expect(result.text).toBe(String.fromCharCode(...units))
    expect(result.text.length).toBe(6)
    expect(result.pieces[0]).toMatchObject({ start: 0, end: 6, byteLength: 12, unicode: true })
  })

  it('uses the DOC compressed mapping without replacing its unspecified C1 controls', () => {
    const result = inspectDoc(compoundFixture(wordStreams([{ units: [0x80, 0x82, 0x8e, 0x9e, 0x9f, 13], unicode: false }])))
    expect(result.text).toBe(String.fromCharCode(0x80, 0x201a, 0x8e, 0x9e, 0x178, 13))
  })

  it('keeps logical order when physical text pieces are reversed', () => {
    const bytes = compoundFixture(wordStreams([
      { units: [65, 66], unicode: false }, { units: [0x4e2d, 13], unicode: true },
    ], { reversePhysical: true }))
    const result = inspectDoc(bytes)
    expect(result.text).toBe('AB中\r')
    expect(result.pieces.map((piece) => piece.start)).toEqual([0, 2])
    expect(result.pieces[0]!.byteOffset).toBeGreaterThan(result.pieces[1]!.byteOffset)
  })

  it.each([0xc1, 0xd9, 0x101, 0x10c, 0x112])('reads effective version %i and the explicitly selected table', (version) => {
    const result = inspectDoc(compoundFixture(wordStreams([{ units: [65, 13], unicode: false }], { version, table: '0Table' })))
    expect(result.version).toBe(version)
    expect(result.tableStream).toBe('0Table')
  })

  it('keeps the aggregate trailing character outside the individual subdocuments', () => {
    const text = 'body\rhead\r\r'
    const result = inspectDoc(compoundFixture(wordStreams([{ units: text.split('').map((unit) => unit.charCodeAt(0)), unicode: false }],
      { storyLengths: [5, 0, 5, 0, 0, 0, 0] })))
    expect(result.stories[0]).toEqual({ kind: 'main', start: 0, end: 5 })
    expect(result.stories[2]).toEqual({ kind: 'header', start: 5, end: 10 })
    expect(result.stories.at(-1)!.end).toBe(10)
    expect(result.text.length).toBe(11)
  })

  it('diagnoses an absent version extension only when the base version and full locator table agree', () => {
    const streams = wordStreams([{ units: [65, 13], unicode: false }], { version: 0x101 })
    const view = new DataView(streams.WordDocument!.buffer)
    view.setUint16(2, 0x101, true)
    view.setUint16(154 + 136 * 8, 0, true)
    const result = inspectDoc(compoundFixture(streams))
    expect(result.version).toBe(0x101)
    expect(result.text).toBe('A\r')
    expect(result.diagnostics.map((item) => item.code)).toEqual(['missing-fib-version-extension'])
    view.setUint16(2, 0x10c, true)
    expect(() => inspectDoc(compoundFixture(streams))).toThrow(/lengths/i)
  })

  it.each([
    ['encryption', 'encrypted-document'], ['version', 'unsupported-version'], ['count', 'invalid-fib'],
    ['clx', 'invalid-text-map'], ['characters', 'invalid-text-map'], ['position', 'invalid-text-map'],
    ['meaningful-bytes', 'invalid-text-map'],
  ])('rejects invalid %s without producing partial text', (caseName, code) => {
    const streams = wordStreams([{ units: [65, 13], unicode: false }])
    const word = new DataView(streams.WordDocument!.buffer)
    const table = new DataView(streams['1Table']!.buffer)
    if (caseName === 'encryption') word.setUint16(10, 0x1300, true)
    if (caseName === 'version') word.setUint16(2, 0x69, true)
    if (caseName === 'count') word.setUint16(32, 0xffff, true)
    if (caseName === 'clx') table.setUint32(1, 0xffffffff, true)
    if (caseName === 'characters') table.setUint32(9, 0, true)
    if (caseName === 'position') table.setUint32(15, 0x40000001, true)
    if (caseName === 'meaningful-bytes') word.setUint32(64, 2049, true)
    expect(() => inspectDoc(compoundFixture(streams))).toThrow(expect.objectContaining({ code }))
  })

  it('distinguishes an encrypted OOXML container and non-Word CFB from readable DOC', () => {
    expect(() => inspectDoc(compoundFixture({ EncryptionInfo: Uint8Array.of(1), EncryptedPackage: Uint8Array.of(2) })))
      .toThrow(/encrypted/i)
    expect(() => inspectDoc(compoundFixture({ Workbook: Uint8Array.of(1) }))).toThrow(/WordDocument/)
    expect(() => inspectDoc(Uint8Array.of(0x50, 0x4b, 3, 4))).toThrow(/container/i)
  })

  it('checks resource budgets and does not mutate or detach the caller input', () => {
    const bytes = compoundFixture(wordStreams([{ units: [65, 13], unicode: false }]))
    const copy = bytes.slice()
    expect(() => inspectDoc(bytes, { limits: { maxTextCodeUnits: 1 } })).toThrow(/limit/i)
    expect(() => inspectDoc(bytes, { limits: { maxInputBytes: 1 } })).toThrow(/limit/i)
    expect(() => inspectDoc(bytes, { limits: { maxPieces: Number.NaN } })).toThrow(/limit/i)
    inspectDoc(bytes)
    expect(bytes).toEqual(copy)
  })
})
