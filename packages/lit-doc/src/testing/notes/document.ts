import { withCharacterRecords } from '../characters'
import { conversionRecords } from '../conversion'
import { operation, withStyleDefinitions } from '../formatting'
import { withParagraphRecords } from '../paragraphs'
import { noteStreams } from './streams'
import type { NoteDocumentOptions, NoteVector } from './types'

/**
 * Adds ordinary PAPX/CHPX and page authorities to independently encoded note PLCs.
 * @param main - Complete main story, including its ending CR.
 * @param footnotes - Ordered footnote vectors.
 * @param endnotes - Ordered endnote vectors.
 * @param options - Explicit authored formatting spans.
 * @returns Complete source streams for the public conversion entry point.
 */
export function noteDocumentStreams(main: string, footnotes: readonly NoteVector[] = [], endnotes: readonly NoteVector[] = [],
  options: NoteDocumentOptions = {}): Record<string, Uint8Array> {
  const text = main + (footnotes.length ? footnotes.map(note => note.text).join('') + '\r' : '')
    + (endnotes.length ? endnotes.map(note => note.text).join('') + '\r' : '') + (footnotes.length || endnotes.length ? '\r' : '')
  let streams = noteStreams(main, footnotes, endnotes)
  const paragraphCuts = [...new Set([0, text.length, ...(options.paragraphs ?? []).flatMap(span => [span.start, span.end])])].sort((a, b) => a - b)
  streams = withParagraphRecords(streams, paragraphCuts.slice(0, -1).map((start, index) => {
    const operations = options.paragraphs?.find(span => span.start <= start && span.end >= paragraphCuts[index + 1]!)?.operations ?? []
    return { cuts: [2048 + start * 2, 2048 + paragraphCuts[index + 1]! * 2], records: [{ bytes: operations, odd: operations.length % 2 === 1 }] }
  }))
  const controls = Array.from({ length: text.length }, (_, cp) => cp).filter(cp => text.charCodeAt(cp) === 2)
  const cuts = [...new Set([0, text.length, ...controls.flatMap(cp => [cp, cp + 1]),
    ...(options.characters ?? []).flatMap(span => [span.start, span.end])])].sort((a, b) => a - b)
  streams = withCharacterRecords(streams, cuts.slice(0, -1).map((start, index) => ({
    cuts: [2048 + start * 2, 2048 + cuts[index + 1]! * 2],
    records: [options.characters?.find(span => span.start <= start && span.end >= cuts[index + 1]!)?.operations
      ?? (text.charCodeAt(start) === 2 ? operation(0x0855, 1) : [])],
  })))
  return conversionRecords(withStyleDefinitions(streams, [{ index: 0 }]), main.length)
}
