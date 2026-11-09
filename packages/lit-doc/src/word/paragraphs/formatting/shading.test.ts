import { expect, it } from 'vitest'
import { inspectDoc } from '../../../inspection'
import { compoundFixture } from '../../../testing/compound'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from '../../../testing/formatting'
import { withParagraphRecords } from '../../../testing/paragraphs'
import { wordStreams } from '../../../testing/word'
import { copyParagraphFormat, defaultParagraphFormat } from './defaults'

/** @param pattern - Raw Ipat. @param foreground - Little-endian COLORREF. @param background - Little-endian COLORREF. @returns Literal ten-byte SHD operation. */
function rgb(pattern: number, foreground = 0xff000000, background = 0xff000000): number[] {
  const bytes = new Uint8Array(10), view = new DataView(bytes.buffer)
  view.setUint32(0, foreground, true); view.setUint32(4, background, true); view.setUint16(8, pattern, true)
  return op(0xc64d, 10, ...bytes)
}

/** @param value - Literal Shd80. @returns Two-byte palette shading operation. */
function old(value: number): number[] { return op(0x442d, value & 255, value >>> 8) }

/** @param parent - Style writes. @param direct - PAPX writes. @returns Independent binary streams. */
function streams(parent: number[] = [], direct: number[] = []) {
  return withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
    cuts: [2048, 2050], records: [{ style: 15, bytes: direct, odd: direct.length % 2 === 1 }]
  }]), [{ index: 0, properties: parent }, { index: 15, parent: 0 }])
}

it.each([
  { name: 'missing value', bytes: [], value: null },
  { name: 'palette colors', bytes: old(13 | 8 << 5), value: { pattern: 0, foreground: '800000', background: 'FFFFFF' } },
  { name: 'explicit automatic colors', bytes: old(0), value: { pattern: 0, foreground: 'auto', background: 'auto' } },
  { name: 'legacy nil exception', bytes: old(0xffff), value: { pattern: 0xffff, foreground: 'auto', background: 'auto' } },
  { name: 'RGB colors', bytes: rgb(0, 0x00563412, 0x00ccbbaa), value: { pattern: 0, foreground: '123456', background: 'AABBCC' } },
  { name: 'modern nil colors', bytes: rgb(0, 0xffffffff, 0xffffffff), value: { pattern: 0xffff, foreground: 'auto', background: 'auto' } },
  { name: 'modern nil pattern', bytes: rgb(0xffff, 0x000000ff, 0x00ff0000), value: { pattern: 0xffff, foreground: 'auto', background: 'auto' } },
  { name: 'nonzero automatic components', bytes: rgb(8, 0xffabcdef), value: { pattern: 8, foreground: 'auto', background: 'auto' } },
  { name: 'unmapped raw pattern', bytes: rgb(35), value: { pattern: 35, foreground: 'auto', background: 'auto' } }
])('reads $name without changing source bytes or unrelated formatting', ({ bytes, value }) => {
  const input = compoundFixture(streams([], bytes)), before = input.slice()
  const result = inspectDoc(input, { includeParagraphFormatting: true })
  expect(result.paragraphs![0]!.baseFormat).toMatchObject({ shading: value, keepNext: false, autoSpaceLatin: true, unsupportedOpcodes: [] })
  expect(input).toEqual(before); expect(JSON.parse(JSON.stringify(result))).toEqual(result)
})

it('inherits the complete source value and explicitly clears it with a later layer', () => {
  expect(inspectDoc(compoundFixture(streams(rgb(0, 0xff000000, 0x00563412))), { includeParagraphFormatting: true })
    .paragraphs![0]!.baseFormat!.shading).toEqual({ pattern: 0, foreground: 'auto', background: '123456' })
  expect(inspectDoc(compoundFixture(streams(rgb(0, 0xff000000, 0x00563412), old(0xffff))), { includeParagraphFormatting: true })
    .paragraphs![0]!.baseFormat!.shading).toEqual({ pattern: 0xffff, foreground: 'auto', background: 'auto' })
})

it.each([false, true])('prefers complete modern shading over the same-layer palette fallback, modern-first=%s', first => {
  const modern = rgb(0, 0xff000000, 0x00563412), legacy = old(8 << 5)
  expect(inspectDoc(compoundFixture(streams([], first ? [...modern, ...legacy] : [...legacy, ...modern])), { includeParagraphFormatting: true })
    .paragraphs![0]!.baseFormat!.shading!.background).toBe('123456')
})

it('applies an ending-piece legacy value after the modern PAPX', () => {
  const source = withPiecePropertyGroup(streams([], rgb(0, 0xff000000, 0x00563412)), old(7 << 5), 0)
  expect(inspectDoc(compoundFixture(source), { includeParagraphFormatting: true }).paragraphs![0]!.baseFormat!.shading!.background).toBe('FFFF00')
})

it('restarts modern precedence and inherited values after a paragraph style reset', () => {
  const bytes = [...rgb(0, 0xff000000, 0x00563412), ...op(0x4600, 16, 0), ...old(7 << 5)]
  const source = withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
    cuts: [2048, 2050], records: [{ style: 15, bytes, odd: bytes.length % 2 === 1 }]
  }]), [{ index: 0, properties: rgb(0, 0xff000000, 0x00ff0000) }, { index: 15, parent: 0 }, { index: 16, parent: 0 }])
  expect(inspectDoc(compoundFixture(source), { includeParagraphFormatting: true }).paragraphs![0]!.baseFormat)
    .toMatchObject({ styleIndex: 16, shading: { pattern: 0, foreground: 'auto', background: 'FFFF00' } })
})

it('isolates source style-cache shading values on a child copy', () => {
  const source = { ...defaultParagraphFormat(0), shading: { pattern: 0, foreground: 'auto', background: 'FF0000' } }
  const copy = copyParagraphFormat(source)
  expect(copy.shading).toEqual(source.shading); expect(copy.shading).not.toBe(source.shading)
})

it.each([old(17), rgb(0, 0x02000000), op(0xc64d, 9, ...new Array<number>(9).fill(0))].map(bytes => ({ bytes })))('refuses invalid shading only in requested formatting: $bytes', ({ bytes }) => {
  const input = compoundFixture(streams([], bytes))
  expect(inspectDoc(input).text).toBe('A\r')
  expect(() => inspectDoc(input, { includeParagraphFormatting: true })).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})
