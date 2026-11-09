import { expect, it } from 'vitest'
import { inspectDoc } from '../../../../inspection'
import { compoundFixture } from '../../../../testing/compound'
import { operation, withStyleDefinitions } from '../../../../testing/formatting'
import { withParagraphRecords } from '../../../../testing/paragraphs'
import { wordStreams } from '../../../../testing/word'

/** @param direct - Paragraph-local operations. @param inherited - Style-owned operations. @returns Complete independent DOC bytes. */
function document(direct: readonly number[], inherited: readonly number[] = []): Uint8Array {
  return compoundFixture(withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
    cuts: [2048, 2050], records: [{ bytes: direct, odd: direct.length % 2 === 1 }],
  }]), [{ index: 0, properties: inherited }]))
}

it('reads original tab positions and descriptors through normal paragraph inspection', () => {
  const result = inspectDoc(document(operation(0xc60d, 8, 0, 2, 0xd0, 2, 0xa0, 5, 0, 9)), { includeParagraphFormatting: true })
  expect(result.paragraphs![0]!.baseFormat!.tabs.stops).toEqual([
    { position: 720, alignment: 0, leader: 0 }, { position: 1440, alignment: 1, leader: 1 },
  ])
  expect(result.paragraphs![0]!.baseFormat!.unsupportedOpcodes).not.toContain(0xc60d)
})

it('keeps inherited stops separate from direct changes and clears within the normative tolerance', () => {
  const inherited = operation(0xc60d, 8, 0, 2, 0xd0, 2, 0xa0, 5, 0, 1)
  const direct = operation(0xc60d, 7, 1, 0xe9, 2, 1, 0x70, 8, 18)
  const result = inspectDoc(document(direct, inherited), { includeParagraphFormatting: true }).paragraphs![0]!.baseFormat!.tabs
  expect(result.stops).toEqual([{ position: 1440, alignment: 1, leader: 0 }, { position: 2160, alignment: 2, leader: 2 }])
  expect(result.changes).toEqual([
    { position: 720, value: null }, { position: 745, value: null },
    { position: 2160, value: { position: 2160, alignment: 2, leader: 2 } },
  ])
  expect(result.rangeDeletion).toBe(true)
})

it('admits the legacy style tab opcode with an explicit compatibility diagnostic', () => {
  const result = inspectDoc(document([], operation(0xc615, 5, 0, 1, 0xd0, 2, 1)), { includeParagraphFormatting: true })
  expect(result.paragraphs![0]!.baseFormat!.tabs.stops).toEqual([{ position: 720, alignment: 1, leader: 0 }])
  expect(result.paragraphs![0]!.baseFormat!.tabs.changes).toEqual([])
  expect(result.diagnostics.some(item => item.code === 'legacy-style-tab-operation')).toBe(true)
})

it.each([
  operation(0xc60d, 5, 0, 1, 0xd0, 2, 5),
  operation(0xc60d, 5, 0, 1, 0xd0, 2, 48),
  operation(0xc60d, 8, 0, 2, 0xa0, 5, 0xd0, 2, 0, 1),
  operation(0xc60d, 4, 0, 1, 0xd0, 2),
])('rejects malformed tab operands through the normal entry %j', (...bytes) => {
  expect(() => inspectDoc(document(bytes), { includeParagraphFormatting: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})
