import { withCharacterRecords } from '../characters'
import { compoundFixture } from '../compound'
import { conversionRecords } from '../conversion'
import { withStyleDefinitions } from '../formatting'
import { withParagraphRecords } from '../paragraphs'
import { wordStreams } from '../word'
import { withFieldTables } from './document'
import type { FieldDocumentOptions } from './types'
import { withBookmarkTables } from '../bookmarks/document'
import { withRevisionAuthors } from '../revisions/authors'
import { withDrawingTables } from '../drawings/streams'
import { withTextboxTables } from '../textboxes/streams'

/**
 * Writes author controls and independently declared formatting/index records.
 * @param text - Complete source text including its final paragraph mark.
 * @param options - Explicit source properties; expected XML never generates this input.
 * @returns Complete DOC bytes accepted by the public conversion API.
 */
export function fieldDocument(text: string, options: FieldDocumentOptions = {}): Uint8Array {
  const units = Array.from({ length: text.length }, (_, index) => text.charCodeAt(index))
  const paragraphCuts = [...new Set([0, text.length, ...(options.paragraphs ?? []).flatMap(span => [span.start, span.end])])].sort((a, b) => a - b)
  let streams = withParagraphRecords(wordStreams([{ units, unicode: true }], options.storyLengths ? { storyLengths: options.storyLengths } : {}), paragraphCuts.slice(0, -1).map((start, index) => {
    const end = paragraphCuts[index + 1]!
    const operations = options.paragraphs?.find(span => span.start <= start && span.end >= end)?.operations ?? []
    return { cuts: [2048 + start * 2, 2048 + end * 2], records: [{ bytes: operations, odd: operations.length % 2 === 1 }] }
  }))
  const cuts = [...new Set([0, text.length, ...(options.characters ?? []).flatMap(span => [span.start, span.end])])].sort((a, b) => a - b)
  streams = withCharacterRecords(streams, cuts.slice(0, -1).map((start, index) => ({
    cuts: [2048 + start * 2, 2048 + cuts[index + 1]! * 2],
    records: [options.characters?.find(span => span.start <= start && span.end >= cuts[index + 1]!)?.operations],
  })))
  streams = conversionRecords(withStyleDefinitions(streams, [{ index: 0 }]), text.length)
  streams = withFieldTables(streams, options.tables ?? [])
  if (options.revisionAuthors) streams = withRevisionAuthors(streams, options.revisionAuthors)
  if (options.drawings) streams = withDrawingTables(streams, options.drawings.content, options.drawings.main, options.drawings.header)
  if (options.textboxes) streams = withTextboxTables(streams, options.textboxes)
  if (options.data) streams = { ...streams, Data: options.data }
  return compoundFixture(options.bookmarks ? withBookmarkTables(streams, options.bookmarks) : streams)
}
