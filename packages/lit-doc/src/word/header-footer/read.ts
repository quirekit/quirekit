import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadDiagnostic, DocReadLimits } from '../../types'
import { readSectionEnds } from '../paragraphs/sections'
import type { WordHeader, WordTextStorage } from '../types'
import type { DocHeaderFooterSource } from './types'

const variants = [
  ['header', 'even'], ['header', 'default'], ['footer', 'even'],
  ['footer', 'default'], ['header', 'first'], ['footer', 'first'],
] as const
const separatorRoles = ['separator', 'continuationSeparator', 'continuationNotice'] as const

/**
 * Reads the complete counted header directory in source CP coordinates.
 * @param table - FIB-selected Table stream.
 * @param header - Validated source locators and concatenated story ranges.
 * @param storage - Original code units, preserving guards and fields.
 * @param limits - Section and slot allocation ceilings.
 * @param diagnostics - Optional sink for source compatibility decisions.
 * @returns Independent source slots with explicit empty/inherited identities.
 */
export function readHeaderFooterRecords(table: Uint8Array, header: WordHeader, storage: WordTextStorage,
  limits: DocReadLimits, diagnostics?: DocReadDiagnostic[]): DocHeaderFooterSource {
  const stream = new ByteView(table, 'invalid-story-data')
  const settings = header.records[31]!
  const evenAndOddHeaders = settings.length
    ? Boolean(new ByteView(stream.slice(settings.offset, settings.length), 'invalid-story-data').u8(0) & 1) : null
  const result: DocHeaderFooterSource = { scope: 'header-footer-source', evenAndOddHeaders, positions: [], separators: [], stories: [] }
  const story = header.stories[2]!
  const length = story.end - story.start
  const range = header.records[11]!
  if (!length) {
    if (range.length) diagnostics?.push({ code: 'stale-header-directory',
      message: 'A nonempty header directory locator is ignored because the header text length is zero.' })
    return result
  }
  requireDoc(length > 0 && range.length > 0 && header.records[6]!.length > 0,
    'invalid-story-data', 'Header text, directory and section table must agree')
  const sectionCount = (header.records[6]!.length - 4) / 16
  requireDoc(Number.isInteger(sectionCount) && sectionCount >= 1, 'invalid-story-data', 'Invalid section count for header directory')
  const storyCount = 6 + sectionCount * 6
  requireDoc(storyCount <= limits.maxHeaderFooterStories, 'limit-exceeded', 'Header/footer story count limit exceeded')
  readSectionEnds(table, header, storage.text, limits)
  requireDoc(range.length === (storyCount + 2) * 4, 'invalid-story-data', 'Header directory length disagrees with section count')
  const source = new ByteView(stream.slice(range.offset, range.length), 'invalid-story-data')

  // The last PLC value is undefined. Validate only the actual starts and final
  // endpoint, then translate relative header CPs into the common source space.
  const positions: number[] = []
  for (let index = 0; index <= storyCount; index++) {
    const position = source.u32(index * 4)
    requireDoc(position < length && position >= (positions[index - 1] ?? 0),
      'invalid-story-data', 'Invalid or unordered header story position')
    positions.push(position)
  }
  requireDoc(positions[0] === 0 && positions[storyCount] === length - 1 && storage.text.charCodeAt(story.end - 1) === 13,
    'invalid-story-data', 'Header directory does not cover its complete source document')

  /** @param index - Original story slot. @returns Absolute content and guard boundaries. */
  function interval(index: number) {
    const start = story.start + positions[index]!
    const end = story.start + positions[index + 1]!
    if (end > start) {
      requireDoc(storage.text.charCodeAt(end - 1) === 13, 'invalid-story-data', 'Header story is missing its guard paragraph')
      requireDoc(index < 6 || end - start >= 2 && storage.text.charCodeAt(end - 2) === 13,
        'invalid-story-data', 'Header/footer content must end with its own paragraph mark')
    }
    return { start, end, contentEnd: end > start ? end - 1 : start }
  }
  return { ...result, positions,
    separators: Array.from({ length: 6 }, (_, index) => ({ kind: index < 3 ? 'footnote' as const : 'endnote' as const,
      role: separatorRoles[index % 3]!, ...interval(index) })),
    stories: Array.from({ length: sectionCount * 6 }, (_, index) => ({ section: Math.floor(index / 6),
      kind: variants[index % 6]![0], variant: variants[index % 6]![1], ...interval(index + 6) })),
  }
}
