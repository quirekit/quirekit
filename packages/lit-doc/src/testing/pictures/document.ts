import { compoundFixture } from '../compound'
import { withCharacterRecords } from '../characters'
import { conversionRecords } from '../conversion'
import { withStyleDefinitions } from '../formatting'
import { withParagraphRecords } from '../paragraphs'
import { wordStreams } from '../word'

/** @param spans - Source text and independently authored direct operation bytes. @param data - Original picture stream. @returns Complete DOC fixture for the public conversion API. */
export function pictureDocument(spans: readonly { text: string, operations?: readonly number[] }[], data: Uint8Array): Uint8Array {
  const text = spans.map(span => span.text).join('') + '\r'
  const units = Array.from({ length: text.length }, (_, index) => text.charCodeAt(index))
  let end = 2048
  const pages = spans.map(span => {
    const start = end
    end += span.text.length * 2
    return { cuts: [start, end], records: [span.operations] }
  })
  pages.push({ cuts: [end, end + 2], records: [undefined] })
  const streams = withStyleDefinitions(withCharacterRecords(withParagraphRecords(wordStreams([{ units, unicode: true }]),
    [{ cuts: [2048, end + 2] }]), pages), [{ index: 0 }, { index: 15, kind: 2 }])
  return compoundFixture({ ...conversionRecords(streams, text.length), Data: data })
}
