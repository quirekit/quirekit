import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { WordHeader } from '../types'

/**
 * Reads only authored main-story section endpoints, without interpreting page layout properties.
 * @param table - FIB-selected Table stream.
 * @param header - Validated source locators and story lengths.
 * @param text - Original logical UTF-16 text.
 * @param limits - Bound on section endpoint allocation.
 * @returns Explicit nonfinal section ends; other form feeds remain manual page breaks.
 */
export function readSectionEnds(table: Uint8Array, header: WordHeader, text: string,
  limits: DocReadLimits): ReadonlySet<number> {
  const range = header.records[6]!
  if (!range.length) return new Set()
  requireDoc(range.length >= 20 && (range.length - 4) % 16 === 0,
    'invalid-paragraph-data', 'Invalid section boundary table length')
  const count = (range.length - 4) / 16
  requireDoc(count <= limits.maxParagraphs, 'limit-exceeded', 'Section boundary limit exceeded')
  const source = new ByteView(table, 'invalid-paragraph-data')
  const view = new ByteView(source.slice(range.offset, range.length), 'invalid-paragraph-data')
  const mainEnd = header.stories[0]!.end
  requireDoc(view.u32(0) === 0, 'invalid-paragraph-data', 'Section table must start at main story CP zero')
  const result = new Set<number>()
  let previous = 0
  for (let i = 1; i <= count; i++) {
    const end = view.u32(i * 4)
    requireDoc(end > previous && end <= 0x7fffffff, 'invalid-paragraph-data', 'Section positions must strictly increase')
    if (i < count) {
      requireDoc(end < mainEnd && text.charCodeAt(end - 1) === 12,
        'invalid-paragraph-data', 'Nonfinal section must end with a main-story section mark')
      result.add(end)
    } else requireDoc(end >= mainEnd, 'invalid-paragraph-data', 'Final section does not cover the main story')
    previous = end
  }
  return result
}
