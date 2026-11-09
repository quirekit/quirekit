import { withCharacterRecords } from '../characters'
import { conversionRecords } from '../conversion'
import { operation, withStyleDefinitions } from '../formatting'
import { withParagraphRecords } from '../paragraphs'
import { commentStreams } from './document'
import type { CommentDocumentOptions, CommentFixture } from './types'

/**
 * Adds independent formatting authorities to authored source comment directories.
 * @param main - Complete main text with actual reference controls.
 * @param comments - Ordered complete original message bodies.
 * @param options - Original metadata and format vectors.
 * @returns Complete root streams for public source-plan tests.
 */
export function commentDocumentStreams(main: string, comments: readonly CommentFixture[],
  options: CommentDocumentOptions = {}): Record<string, Uint8Array> {
  const text = main + (comments.length ? comments.map(comment => comment.text).join('') + '\r\r' : '')
  let streams = commentStreams(main, comments, options)
  const paragraphs = [...new Set([0, text.length, ...(options.paragraphs ?? []).flatMap(span => [span.start, span.end])])].sort((a, b) => a - b)
  streams = withParagraphRecords(streams, paragraphs.slice(0, -1).map((start, index) => {
    const end = paragraphs[index + 1]!
    const bytes = options.paragraphs?.find(span => span.start <= start && span.end >= end)?.operations ?? []
    return { cuts: [2048 + start * 2, 2048 + end * 2], records: [{ bytes, odd: bytes.length % 2 === 1 }] }
  }))
  const controls = Array.from({ length: text.length }, (_, cp) => cp).filter(cp => [5, 19, 20, 21].includes(text.charCodeAt(cp)))
  const cuts = [...new Set([0, text.length, ...controls.flatMap(cp => [cp, cp + 1]),
    ...(options.characters ?? []).flatMap(span => [span.start, span.end])])].sort((a, b) => a - b)
  streams = withCharacterRecords(streams, cuts.slice(0, -1).map((start, index) => ({
    cuts: [2048 + start * 2, 2048 + cuts[index + 1]! * 2],
    records: [options.characters?.find(span => span.start <= start && span.end >= cuts[index + 1]!)?.operations
      ?? (controls.includes(start) ? operation(0x0855, 1) : [])],
  })))
  return conversionRecords(withStyleDefinitions(streams, [{ index: 0 }]), main.length)
}
