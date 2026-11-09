import { compoundFixture } from './compound'
import { withCharacterRecords } from './characters'
import { conversionRecords } from './conversion'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from './formatting'
import { withParagraphRecords } from './paragraphs'
import { wordStreams } from './word'

/** @param carrier - Original CHPX mark or ending-piece comparison carrier. @param noProof - Whether to exercise the true/true proofing exception. @returns Complete normative DOC with distinct text and paragraph-mark formatting. */
export function majorityDocument(carrier: 'direct' | 'piece' = 'direct', noProof = false): Uint8Array {
  const selector = [...op(0x4a43, 28, 0), ...op(0x486d, 25, 4), ...(noProof ? op(0x0875, 1) : [])]
  const majority = op(0xca47, selector.length, ...selector)
  const prefix = [...op(0x0835, 0x81), ...op(0x4a43, 28, 0), ...op(0x486d, 9, 4), ...(noProof ? op(0x0875, 1) : [])]
  let streams = withStyleDefinitions(withCharacterRecords(withParagraphRecords(wordStreams([{ units: [65, 66, 13], unicode: false }]), [
    { cuts: [2048, 2051], records: [{ style: 1 }] },
  ]), [{ cuts: [2048, 2050, 2051], records: [prefix, carrier === 'direct' ? [...prefix, ...majority] : prefix] }]), [
    { index: 0 }, { index: 1, parent: 0, properties: op(0x2640, 0), characters: [...op(0x0835, 1), ...op(0x4a43, 28, 0), ...op(0x486d, 25, 4)] },
  ])
  if (carrier === 'piece') streams = withPiecePropertyGroup(streams, majority, 0)
  return compoundFixture(conversionRecords(streams, 3))
}
