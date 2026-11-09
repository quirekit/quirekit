import { requireDoc } from '../../errors'
import type { DocReadDiagnostic, DocReadLimits } from '../../types'
import { readFormattingIndex } from '../properties/storage'
import type { ParagraphSourceRecord } from '../paragraphs/types'
import type { WordAllocationBudget, WordHeader, WordTextStorage } from '../types'
import { readCharacterPage } from './page'
import type { CharacterSourceRecord } from './types'

/**
 * Intersects logical pieces and paragraphs with physical CHPX and BTE extents.
 * @param word - WordDocument stream.
 * @param table - Selected Table stream.
 * @param header - Validated FIB locators.
 * @param storage - Logical text pieces.
 * @param paragraphs - Contiguous absolute paragraph authorities for one source story.
 * @param limits - Index and logical-run allocation ceilings.
 * @param budget - Shared run allocations across independently recoverable stories.
 * @param diagnostics - Shared owner for bounded original-format compatibility decisions.
 * @returns Source runs in logical CP order, including terminating control units.
 */
export function readCharacterSources(word: Uint8Array, table: Uint8Array, header: WordHeader, storage: WordTextStorage,
  paragraphs: readonly ParagraphSourceRecord[], limits: DocReadLimits,
  budget: WordAllocationBudget = { remaining: limits.maxCharacterRuns }, diagnostics?: DocReadDiagnostic[]): readonly CharacterSourceRecord[] {
  const index = readFormattingIndex(word, table, header, limits, {
    field: 12, label: 'Character', code: 'invalid-formatting-data', readPage: readCharacterPage,
  })
  requireDoc(paragraphs.length > 0, 'invalid-paragraph-data', 'Character inspection requires source paragraphs')
  const storyStart = paragraphs[0]!.start
  const storyEnd = paragraphs[paragraphs.length - 1]!.end
  const main = header.stories[0]!
  const result: CharacterSourceRecord[] = []
  let paragraphIndex = 0
  for (let pieceIndex = 0; pieceIndex < storage.pieces.length; pieceIndex++) {
    const piece = storage.pieces[pieceIndex]!
    if (piece.start >= storyEnd) break
    if (piece.end <= storyStart) continue
    const width = piece.unicode ? 2 : 1
    const pieceEnd = Math.min(piece.end, storyEnd)
    for (let cp = Math.max(piece.start, storyStart); cp < pieceEnd;) {
      while (cp >= paragraphs[paragraphIndex]!.end) paragraphIndex++
      const paragraph = paragraphs[paragraphIndex]!
      const fc = piece.byteOffset + (cp - piece.start) * width
      // A few original producers omit only the final main-story CR's CHPX.
      // The complete PAPX still supplies its style; two exact physical ends
      // authorize an empty direct layer, never a copy of the preceding run.
      const absentTerminal = storyStart === main.start && storyEnd === main.end && main.kind === 'main'
        && cp === main.end - 1 && cp > piece.start && !piece.propertyModifier
        && storage.text.charCodeAt(cp) === 13 && index.endsAt(fc)
      const { record, rangeEnd } = absentTerminal
        ? { record: { byteStart: fc, byteEnd: fc + width, properties: new Uint8Array(0) }, rangeEnd: fc + width }
        : index.locate(fc, width)
      const bytes = Math.min(record.byteEnd - fc, rangeEnd - fc, (pieceEnd - cp) * width, (paragraph.end - cp) * width)
      requireDoc(bytes >= width && bytes % width === 0, 'invalid-formatting-data', 'Character range splits a UTF-16 code unit')
      requireDoc(result.length < limits.maxCharacterRuns && budget.remaining > 0, 'limit-exceeded', 'Character run count limit exceeded')
      budget.remaining--
      const end = cp + bytes / width
      result.push({ start: cp, end, paragraphIndex, pieceIndex, formatting: record, propertyModifier: piece.propertyModifier })
      if (absentTerminal) diagnostics?.push({ code: 'terminal-character-format-absent',
        message: 'The final main-story paragraph mark has no direct CHPX: its complete BTE and final FKP end exactly before it, so the original paragraph style remains authoritative.' })
      cp = end
    }
  }
  return result
}
