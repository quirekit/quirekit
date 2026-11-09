import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { WordHeader, WordTextStorage } from '../types'
import type { DocNoteRange, DocNotesSource } from './types'

/**
 * Connects the independent main-story and content PLCs without interpreting note formatting.
 * @param table - FIB-selected source table stream.
 * @param header - Validated story ranges and source locators.
 * @param storage - Immutable concatenated UTF-16 source text.
 * @param limits - Shared note allocation ceiling for both families.
 * @returns Absolute note intervals and original automatic/custom selectors.
 */
export function readNoteRecords(table: Uint8Array, header: WordHeader, storage: WordTextStorage, limits: DocReadLimits): DocNotesSource {
  const stream = new ByteView(table, 'invalid-story-data')
  const entries: DocNoteRange[] = []
  const anchors = new Set<number>()
  let remaining = limits.maxNotes
  for (const [kind, storyIndex, referenceIndex, textIndex] of [['footnote', 1, 2, 3], ['endnote', 4, 46, 47]] as const) {
    const story = header.stories[storyIndex]!
    const referenceRange = header.records[referenceIndex]!
    const textRange = header.records[textIndex]!
    const count = referenceRange.length ? (referenceRange.length - 4) / 6 : 0
    requireDoc(Number.isInteger(count) && count >= 0, 'invalid-story-data', 'Invalid note reference directory size')
    requireDoc(count <= remaining, 'limit-exceeded', 'Combined footnote/endnote count limit exceeded')
    remaining -= count
    const length = story.end - story.start
    if (!length) {
      requireDoc(count === 0 && textRange.length === 0, 'invalid-story-data', 'Empty note story has active source indexes')
      continue
    }
    requireDoc(textRange.length === (count + 2) * 4, 'invalid-story-data', 'Note reference and content counts disagree')
    const content = new ByteView(stream.slice(textRange.offset, textRange.length), 'invalid-story-data')
    // Only real endpoints belong to the authority. Both PLCs have a final
    // undefined CP, which can be outside the document even in valid originals.
    requireDoc(content.u32(0) === 0 && content.u32(count * 4) === length - 1
      && storage.text.charCodeAt(story.end - 1) === 13, 'invalid-story-data', 'Note directory does not cover its complete story')
    if (!count) continue
    const references = new ByteView(stream.slice(referenceRange.offset, referenceRange.length), 'invalid-story-data')
    let previousAnchor = -1
    let localStart = 0
    for (let index = 0; index < count; index++) {
      const anchor = references.u32(index * 4)
      const referenceValue = references.u16((count + 1) * 4 + index * 2)
      requireDoc(anchor > previousAnchor && anchor < header.stories[0]!.end && !anchors.has(anchor),
        'invalid-story-data', 'Invalid, unordered or duplicate note anchor')
      requireDoc(referenceValue === 0 || storage.text.charCodeAt(anchor) === 2,
        'invalid-story-data', 'Automatic note reference does not point to its source control')
      const localEnd = content.u32((index + 1) * 4)
      requireDoc(localEnd > localStart && localEnd < length && storage.text.charCodeAt(story.start + localEnd - 1) === 13,
        'invalid-story-data', 'Invalid note text range or missing paragraph ending')
      entries.push({ kind, index, anchor, start: story.start + localStart, end: story.start + localEnd,
        referenceValue, autoNumbered: referenceValue !== 0 })
      anchors.add(anchor)
      previousAnchor = anchor
      localStart = localEnd
    }
  }
  return { scope: 'note-source', entries }
}
