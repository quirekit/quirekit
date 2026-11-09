import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { ParagraphSourceRecord } from '../paragraphs/types'
import { readPieceParagraphProperties } from '../properties/piece'
import type { PropertyReader } from '../properties/types'
import type { WordTextStorage } from '../types'
import type { TableParagraphRole } from './types'

/**
 * Resolves membership from direct properties only, without inheriting it from styles.
 * @param paragraphs - Complete source paragraphs.
 * @param storage - Original text and piece modifiers.
 * @param reader - Shared bounded property reader.
 * @param limits - Table nesting policy.
 * @param version - Effective FIB generation bounding legacy membership compatibility.
 * @param paragraphOffset - First canonical paragraph index when reading a bounded story slice.
 * @returns Ordered roles, retaining separate row terminators.
 */
export function readTableRoles(paragraphs: readonly ParagraphSourceRecord[], storage: WordTextStorage,
  reader: PropertyReader, limits: DocReadLimits, version: number, paragraphOffset = 0): readonly TableParagraphRole[] {
  return paragraphs.map((paragraph, index) => {
    const direct = reader.read(paragraph.formatting.properties)
    const piece = readPieceParagraphProperties(paragraph.propertyModifier, storage, reader)
    reader.consume(direct.length + piece.length)
    // Shared PAPX carries ordinary fields throughout its interval, while the
    // structural end flags belong only to its final paragraph. Piece ownership
    // stays independent and is applied after that source-specific restriction.
    const paragraphOperations = paragraph.endsFormattingRecord ? direct
      : direct.filter(operation => ![0x2417, 0x244b, 0x244c].includes(operation.opcode))
    const operations = [...paragraphOperations, ...piece]
    let member = false; let level = 0; let outerRow = false; let innerCell = false; let innerRow = false
    let explicitDepth = false
    for (const operation of operations) {
      const value = new ByteView(operation.operand, 'invalid-table-data')
      const code = operation.opcode
      if ([0x2416, 0x2417, 0x244b, 0x244c].includes(code)) {
        requireDoc(value.u8(0) <= 1, 'invalid-table-data', 'Invalid table-role Boolean')
        const flag = value.u8(0) === 1
        if (code === 0x2416) member = flag
        if (code === 0x2417) outerRow = flag
        if (code === 0x244b) innerCell = flag
        if (code === 0x244c) innerRow = flag
      } else if (code === 0x6649 || code === 0x664a) {
        explicitDepth = true
        const unsigned = value.u32(0)
        const signed = unsigned > 0x7fffffff ? unsigned - 0x100000000 : unsigned
        level = code === 0x6649 ? signed : level + signed
        requireDoc(level >= 0, 'invalid-table-data', 'Negative table nesting depth')
      }
    }
    // Older flat tables can declare membership without a depth operation. Resolve
    // that absence only after direct overrides, retaining explicit zero and inner
    // flags for the normal structural checks rather than repairing their values.
    const implicitDepth = member && !explicitDepth && !innerCell && !innerRow && (version === 0xc1 || version === 0xd9)
    if (implicitDepth) level = 1
    requireDoc(level <= limits.maxTableDepth, 'limit-exceeded', 'Table nesting depth limit exceeded')
    requireDoc(member || level === 0, 'invalid-table-data', 'Table depth requires direct membership')
    requireDoc(!member || level > 0, 'unsupported-table', 'Table membership without a nonzero depth is not admitted')
    const mark = storage.text.charCodeAt(paragraph.end - 1)
    const row = level === 1 ? outerRow : innerRow
    requireDoc((!outerRow || level === 1) && (!(innerCell || innerRow) || level > 1),
      'invalid-table-data', 'Table end flags disagree with the source depth')
    requireDoc(level !== 0 || mark !== 7, 'invalid-table-data', 'Cell marker outside a table')
    requireDoc(level === 0 || (level === 1 ? mark === 7 || mark === 13 : mark === 13),
      'invalid-table-data', 'Table paragraph has an invalid source marker')
    requireDoc(!row || paragraph.end - paragraph.start === 1 && mark === (level === 1 ? 7 : 13),
      'invalid-table-data', 'Table row marker must be a standalone source character')
    return { start: paragraph.start, end: paragraph.end, ending: paragraph.ending, index: index + paragraphOffset, level,
      role: !level ? 'body' : row ? 'row' : level === 1 && mark === 7 || innerCell ? 'cell' : 'paragraph', operations,
      ...(implicitDepth ? { implicitDepth: true } : {}) }
  })
}
