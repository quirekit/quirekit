import { withCharacterRecords } from '../characters'
import { conversionRecords } from '../conversion'
import { withStyleDefinitions } from '../formatting'
import { withParagraphRecords } from '../paragraphs'
import { headerFooterStreams } from './source'

/**
 * Adds ordinary semantic authorities to independent header source vectors.
 * @param sections - Six full stored stories per section, including paragraph guards.
 * @param options - Parity, title-page switches and source character operation spans.
 * @returns Complete independently owned DOC streams for public conversion.
 */
export function headerDocumentStreams(sections: readonly (readonly string[])[], options: {
  evenAndOdd?: boolean, titlePages?: readonly boolean[],
  paragraphs?: readonly { start: number, end: number, operations: readonly number[] }[],
  characters?: readonly { start: number, end: number, operations: readonly number[] }[],
} = {}): Record<string, Uint8Array> {
  let streams = headerFooterStreams(sections, options)
  const sourceFib = new DataView(streams.WordDocument!.buffer)
  const textLength = sections.length * 2 + 12 + sections.flat().join('').length + 2
  const settings = [sourceFib.getUint32(154 + 31 * 8, true), sourceFib.getUint32(158 + 31 * 8, true)] as const
  const paragraphCuts = [...new Set([0, textLength, ...(options.paragraphs ?? []).flatMap(span => [span.start, span.end])])].sort((a, b) => a - b)
  streams = withParagraphRecords(streams, paragraphCuts.slice(0, -1).map((start, index) => {
    const operations = options.paragraphs?.find(span => span.start <= start && span.end >= paragraphCuts[index + 1]!)?.operations ?? []
    return { cuts: [2048 + start * 2, 2048 + paragraphCuts[index + 1]! * 2], records: [{ bytes: operations, odd: operations.length % 2 === 1 }] }
  }), sections.map((_, index) => (index + 1) * 2))
  const cuts = [...new Set([0, textLength, ...(options.characters ?? []).flatMap(span => [span.start, span.end])])].sort((a, b) => a - b)
  streams = withCharacterRecords(streams, cuts.slice(0, -1).map((start, index) => ({
    cuts: [2048 + start * 2, 2048 + cuts[index + 1]! * 2],
    records: [options.characters?.find(span => span.start <= start && span.end >= cuts[index + 1]!)?.operations],
  })))
  streams = withStyleDefinitions(streams, [{ index: 0 }])
  const before = new DataView(streams.WordDocument!.buffer)
  const sectionOffset = before.getUint32(154 + 6 * 8, true)
  const complete = conversionRecords(streams, sections.length * 2)
  const fib = new DataView(complete.WordDocument!.buffer)
  const table = new DataView(complete['1Table']!.buffer)
  const pageOffset = table.getUint32(fib.getUint32(154 + 6 * 8, true) + 10, true)
  const pageLength = fib.getUint16(pageOffset, true)
  const page = complete.WordDocument!.slice(pageOffset + 2, pageOffset + 2 + pageLength)
  const word = new Uint8Array(complete.WordDocument!.length + sections.length * (pageLength + 5))
  word.set(complete.WordDocument!)
  const output = new DataView(word.buffer)
  output.setUint32(64, word.length, true)
  output.setUint32(154 + 6 * 8, sectionOffset, true)
  output.setUint32(158 + 6 * 8, 4 + sections.length * 16, true)
  output.setUint32(154 + 31 * 8, settings[0], true)
  output.setUint32(158 + 31 * 8, settings[1], true)
  sections.forEach((_, index) => {
    const offset = complete.WordDocument!.length + index * (pageLength + 5)
    output.setUint16(offset, pageLength + 3, true)
    word.set(page, offset + 2)
    word.set([0x0a, 0x30, options.titlePages?.[index] ? 1 : 0], offset + 2 + pageLength)
    table.setUint32(sectionOffset + (sections.length + 1) * 4 + index * 12 + 2, offset, true)
  })
  return { ...complete, WordDocument: word }
}
