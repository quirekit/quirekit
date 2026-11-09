import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../../../inspection'
import { compoundFixture } from '../../../testing/compound'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from '../../../testing/formatting'
import { withParagraphRecords } from '../../../testing/paragraphs'
import { wordStreams } from '../../../testing/word'
import { applyParagraphProperties } from './apply'
import { defaultParagraphFormat } from './defaults'
import { createPropertyReader } from '../../properties/reader'
import { resolveLimits } from '../../../binary/limits'
import type { ParagraphPropertyKey } from './types'

/** @param values - Independent source DE/DN operands; omission inherits. @returns Literal operation bytes. */
function flags(values: readonly (number | undefined)[] = []): number[] {
  return [0x2437, 0x2438].flatMap((opcode, index) => values[index] === undefined ? [] : op(opcode, values[index]!))
}

/** @param parent - Parent style source operands. @param child - Child style operands. @param direct - Direct source operands. @returns Independent CFB stream inputs. */
function streams(parent?: readonly (number | undefined)[], child?: readonly (number | undefined)[], direct?: readonly (number | undefined)[]) {
  const bytes = flags(direct)
  return withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [0x4e2d, 65, 0x6587, 49, 13], unicode: true }]), [{
    cuts: [2048, 2058], records: [{ style: 15, bytes, odd: bytes.length % 2 === 1 }]
  }]), [{ index: 0, properties: flags(parent) }, { index: 15, parent: 0, properties: flags(child) }])
}

describe('DOC East Asian automatic spacing source fields', () => {
  it.each([
    { name: 'normative defaults', expected: [true, true] },
    { name: 'both disabled by the parent', parent: [0, 0], expected: [false, false] },
    { name: 'Latin-only child override', parent: [0, 0], child: [1], expected: [true, false] },
    { name: 'numeric-only direct override', parent: [0, 0], direct: [undefined, 1], expected: [false, true] },
    { name: 'explicit direct zero against inherited true', parent: [1, 1], direct: [0, 0], expected: [false, false] },
    { name: 'explicit direct true against inherited false', parent: [0, 0], direct: [1, 1], expected: [true, true] }
  ])('retains $name independently of style identity', ({ parent, child, direct, expected }) => {
    const input = compoundFixture(streams(parent, child, direct)), before = input.slice()
    const result = inspectDoc(input, { includeParagraphFormatting: true }), format = result.paragraphs![0]!.baseFormat!
    expect([format.autoSpaceLatin, format.autoSpaceNumber]).toEqual(expected)
    expect(format).toMatchObject({ styleIndex: 15, unsupportedOpcodes: [], keepNext: false })
    expect(result.text).toBe('中A文1\r'); expect(input).toEqual(before)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('keeps explicit false and true in the local field-presence set', () => {
    const format = defaultParagraphFormat(0), fields = new Set<ParagraphPropertyKey>()
    applyParagraphProperties(format, [{ opcode: 0x2437, operand: Uint8Array.of(0) }, { opcode: 0x2438, operand: Uint8Array.of(1) }],
      createPropertyReader(undefined, resolveLimits({})), fields)
    expect([...fields]).toEqual(['autoSpaceLatin', 'autoSpaceNumber'])
    expect(format).toMatchObject({ autoSpaceLatin: false, autoSpaceNumber: true })
  })

  it('applies the ending piece after the direct paragraph layer', () => {
    const source = withPiecePropertyGroup(streams([0, 0], [1, 1], [1, 1]), flags([0, 0]), 0)
    expect(inspectDoc(compoundFixture(source), { includeParagraphFormatting: true }).paragraphs![0]!.baseFormat)
      .toMatchObject({ autoSpaceLatin: false, autoSpaceNumber: false })
  })

  it('replaces both flags at PIstd before applying later direct writes', () => {
    const bytes = [...flags([1, 0]), ...op(0x4600, 16, 0), ...flags([undefined, 1])]
    const source = withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
      cuts: [2048, 2050], records: [{ style: 15, bytes, odd: bytes.length % 2 === 1 }]
    }]), [{ index: 0, properties: flags([0, 0]) }, { index: 15, parent: 0, properties: flags([1, 1]) },
      { index: 16, parent: 0, properties: flags([0, 0]) }])
    expect(inspectDoc(compoundFixture(source), { includeParagraphFormatting: true }).paragraphs![0]!.baseFormat)
      .toMatchObject({ styleIndex: 16, autoSpaceLatin: false, autoSpaceNumber: true })
  })

  it.each([2, 255])('refuses malformed Bool8 %i only when formatting is requested', value => {
    const input = compoundFixture(streams(undefined, undefined, [value, 0]))
    expect(inspectDoc(input).text).toBe('中A文1\r')
    expect(() => inspectDoc(input, { includeParagraphFormatting: true })).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })
})
