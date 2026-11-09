import { compoundFixture } from './compound'
import { withCharacterRecords } from './characters'
import { conversionRecords } from './conversion'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from './formatting'
import { withParagraphRecords } from './paragraphs'
import { wordStreams } from './word'

/** @param carrier - Explicit zero's independent source owner. @param tail - Later direct or piece operations. @returns Complete legacy-compatibility DOC bytes with no unrelated special run properties. */
export function zeroSizeDocument(carrier: 'direct' | 'piece' | 'paragraph' | 'character' | 'unused-character' = 'direct', tail: readonly number[] = []): Uint8Array {
  const zero = op(0x4a43, 0, 0), characters = carrier === 'direct' ? [...zero, ...tail] : carrier === 'character' ? [...op(0x4a30, 12, 0), ...tail] : [...tail]
  let streams = withStyleDefinitions(withCharacterRecords(withParagraphRecords(wordStreams([{ units: [65, 66, 13], unicode: false }]), [
    { cuts: [2048, 2051], records: [{}] },
  ]), [{ cuts: [2048, 2051], records: [characters] }]), [
    { index: 0, characters: carrier === 'paragraph' ? zero : [] },
    ...(carrier === 'character' || carrier === 'unused-character' ? [{ index: 12, kind: 2, characters: zero }] : []),
  ])
  if (carrier === 'piece') streams = withPiecePropertyGroup(streams, [...zero, ...tail], 0)
  return compoundFixture(conversionRecords(streams, 3))
}
