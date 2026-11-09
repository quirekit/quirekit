import { requireDoc } from '../../errors'
import type { DocReadDiagnostic, DocReadLimits, DocStoryRange } from '../../types'
import type { WordAllocationBudget, WordHeader, WordTextStorage } from '../types'
import { readSectionEnds } from './sections'
import { readParagraphPropertyIndex } from './storage'
import type { ParagraphSourceRecord } from './types'

/**
 * Inspects logical main-story paragraphs and associates each ending with its source properties.
 * @param word - Original WordDocument stream.
 * @param table - FIB-selected Table stream.
 * @param header - Validated counts and locators.
 * @param storage - Logical text and pieces, including unresolved piece modifiers.
 * @param limits - Paragraph and formatting-page allocation ceilings.
 * @param story - Optional independent source subdocument, using absolute CP coordinates.
 * @param budget - Shared paragraph allocations across independently recoverable stories.
 * @param recoveryDiagnostics - Enables local defaults only for wholly absent property coverage.
 * @returns Story spans with internal source references, without resolved formatting.
 */
export function readParagraphRecords(word: Uint8Array, table: Uint8Array, header: WordHeader,
  storage: WordTextStorage, limits: DocReadLimits, story: DocStoryRange = header.stories[0]!,
  budget: WordAllocationBudget = { remaining: limits.maxParagraphs }, recoveryDiagnostics?: DocReadDiagnostic[]): readonly ParagraphSourceRecord[] {
  const { start: storyStart, end: storyEnd } = story
  requireDoc(storyEnd > storyStart && storyEnd <= storage.text.length && storage.text.charCodeAt(storyEnd - 1) === 13,
    'invalid-paragraph-data', `${story.kind} story must end with a paragraph mark`)
  const sections = story.kind === 'main' ? readSectionEnds(table, header, storage.text, limits) : new Set<number>()
  const properties = readParagraphPropertyIndex(word, table, header, limits, recoveryDiagnostics)
  const paragraphs: ParagraphSourceRecord[] = []
  let start = storyStart
  let pieceIndex = 0

  // Scan logical CPs, then consult physical records only at paragraph endings.
  // A shared PAPX can span multiple marks; form feeds require independent section evidence.
  for (let cp = storyStart; cp < storyEnd; cp++) {
    const unit = storage.text.charCodeAt(cp)
    if (unit !== 13 && unit !== 7 && !(unit === 12 && sections.has(cp + 1))) continue
    requireDoc(paragraphs.length < limits.maxParagraphs && budget.remaining > 0, 'limit-exceeded', 'Paragraph count limit exceeded')
    while (cp >= storage.pieces[pieceIndex]!.end) pieceIndex++
    const piece = storage.pieces[pieceIndex]!
    const width = piece.unicode ? 2 : 1
    const fc = piece.byteOffset + (cp - piece.start) * width
    const formatting = properties.locate(fc, width)
    budget.remaining--
    paragraphs.push({ start, end: cp + 1, ending: unit === 13 ? 'paragraph' : unit === 7 ? 'cell-or-row' : 'section',
      formatting, pieceIndex, propertyModifier: piece.propertyModifier, endsFormattingRecord: !formatting.defaulted && fc + width === formatting.byteEnd })
    start = cp + 1
  }
  return paragraphs
}
