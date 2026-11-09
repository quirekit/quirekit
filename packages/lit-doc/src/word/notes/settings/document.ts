import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { WordHeader } from '../../types'
import type { DocLegacyNoteRule, DocNoteDocumentSettings } from './types'

/**
 * Selects active DOP fields by effective version while ignoring obsolete bit patterns.
 * @param table - FIB-selected table stream.
 * @param header - Effective version and original DOP locator.
 * @returns Active document settings, absent when the source has no DOP.
 */
export function readNoteDocumentSettings(table: Uint8Array, header: WordHeader): DocNoteDocumentSettings | null {
  const range = header.records[31]!
  if (!range.length) return null
  const source = new ByteView(new ByteView(table, 'invalid-formatting-data').slice(range.offset, range.length), 'invalid-formatting-data')
  const endnotePosition = source.u16(54) & 3
  requireDoc(endnotePosition === 0 || endnotePosition === 3, 'invalid-formatting-data', 'Invalid document endnote position')
  if (header.version > 0xd9) return { endnotePosition }
  const position = source.u8(0) >>> 5 & 3
  requireDoc(position <= 2, 'invalid-formatting-data', 'Invalid document footnote position')
  return { endnotePosition, legacyNumbering: {
    footnote: { ...readLegacyRule(source, 2, 492), position },
    endnote: readLegacyRule(source, 52, 494),
  } }
}

/**
 * Separates the original two-bit restart selector from its fourteen-bit start.
 * @param source - Complete active document properties.
 * @param offset - Numbering packed-word offset.
 * @param formatOffset - MSONFC word offset.
 * @returns Unmapped original numbering rule.
 */
function readLegacyRule(source: ByteView, offset: number, formatOffset: number): DocLegacyNoteRule {
  const packed = source.u16(offset)
  const restart = packed & 3
  requireDoc(restart <= 2, 'invalid-formatting-data', 'Invalid document note restart selector')
  return { format: source.u16(formatOffset), restart, start: packed >>> 2 }
}
