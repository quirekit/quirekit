import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../../../inspection'
import { compoundFixture } from '../../../testing/compound'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from '../../../testing/formatting'
import { withParagraphRecords } from '../../../testing/paragraphs'
import { wordStreams } from '../../../testing/word'

/**
 * Builds source layers independently of the paragraph interpreter.
 * @param parent - Parent style outline, omitted for the source default.
 * @param child - Child style outline, omitted to inherit.
 * @param direct - Paragraph override, omitted to inherit the child.
 * @returns Independently encoded original stream bytes before compound packaging.
 */
function streams(parent?: number, child?: number, direct?: number): Record<string, Uint8Array> {
  const directBytes = direct === undefined ? [] : op(0x2640, direct)
  return withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
    cuts: [2048, 2050], records: [{ style: 15, bytes: directBytes, odd: directBytes.length % 2 === 1 }],
  }]), [{ index: 0, properties: parent === undefined ? [] : op(0x2640, parent) },
    { index: 15, parent: 0, properties: child === undefined ? [] : op(0x2640, child) }])
}

describe('DOC outline levels from pinned POI paragraph semantics', () => {
  it.each([
    { name: 'default body', expected: 9 },
    { name: 'inherited root heading', parent: 0, expected: 0 },
    { name: 'custom child heading', parent: 0, child: 4, expected: 4 },
    { name: 'direct body excludes a heading style', parent: 0, child: 4, direct: 9, expected: 9 },
    { name: 'direct level zero is not absence', parent: 4, direct: 0, expected: 0 },
  ])('keeps $name without changing paragraph identity', ({ parent, child, direct, expected }) => {
    const bytes = compoundFixture(streams(parent, child, direct)), before = bytes.slice()
    const result = inspectDoc(bytes, { includeParagraphFormatting: true })
    expect(result.paragraphs![0]!.baseFormat).toMatchObject({ outlineLevel: expected, styleIndex: 15, unsupportedOpcodes: [] })
    expect(bytes).toEqual(before)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('applies the existing short ending-piece mapping after direct outline', () => {
    const source = streams(0, 2, 4)
    new DataView(source['1Table']!.buffer).setUint16(5 + 2 * 4 + 6, (9 << 8) | (0x78 << 1), true)
    expect(inspectDoc(compoundFixture(source), { includeParagraphFormatting: true }).paragraphs![0]!.baseFormat)
      .toMatchObject({ outlineLevel: 9 })
  })

  it('applies the existing long ending-piece mapping after direct outline', () => {
    const source = withPiecePropertyGroup(streams(0, 2, 4), op(0x2640, 8), 0)
    expect(inspectDoc(compoundFixture(source), { includeParagraphFormatting: true }).paragraphs![0]!.baseFormat)
      .toMatchObject({ outlineLevel: 8 })
  })

  it.each([10, 255])('rejects invalid outline %i only when source formatting is requested', value => {
    const bytes = compoundFixture(streams(undefined, undefined, value))
    expect(inspectDoc(bytes).text).toBe('A\r')
    expect(() => inspectDoc(bytes, { includeParagraphFormatting: true }))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })
})
