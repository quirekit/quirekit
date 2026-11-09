import { compoundFixture } from './compound'
import { conversionRecords } from './conversion'
import { withCharacterRecords } from './characters'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from './formatting'
import { numberingRecordsFixture, withNumberingRecords } from './numbering'
import { withParagraphRecords } from './paragraphs'
import { wordStreams } from './word'

/** @param direct - First paragraph's ordered PAPX operations. @param piece - Optional later paragraph/character piece changes. @param characters - First paragraph CHPX. @returns Complete independent two-paragraph DOC with contrasting styles and a real list definition. */
export function styleResetDocument(direct: readonly number[], piece?: readonly number[], characters: readonly number[] = []) {
  let source = withParagraphRecords(wordStreams([{ units: [65, 66, 13, 67, 13], unicode: false }]), [
    { cuts: [2048, 2051], records: [{ style: 0, bytes: direct, odd: direct.length % 2 === 1 }] },
    { cuts: [2051, 2053], records: [{ style: 0 }] },
  ])
  source = withStyleDefinitions(withCharacterRecords(source, [{ cuts: [2048, 2051, 2053], records: [characters, undefined] }]), [
    { index: 0, characters: op(0x0835, 1) }, { index: 1 }, { index: 9 },
    { index: 15, parent: 16, properties: op(0x2406, 1), characters: [...op(0x0835, 0), ...op(0x4a43, 36, 0)] },
    { index: 16, properties: [...op(0x2405, 1), ...op(0x460b, 1, 0), ...op(0xc60d, 5, 0, 1, 0xd0, 2, 0)] },
    { index: 17, kind: 2, characters: op(0x0836, 1) },
  ])
  if (piece) source = withPiecePropertyGroup(source, piece, 0)
  return compoundFixture(conversionRecords(withNumberingRecords(source, numberingRecordsFixture()), 5))
}
