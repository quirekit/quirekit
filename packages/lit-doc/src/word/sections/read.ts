import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { WordDocumentSource } from '../document/types'
import { readSectionEnds } from '../paragraphs/sections'
import type { PropertyReader } from '../properties/types'
import type { WordSectionRecord } from './types'

/**
 * Reads each section's own property group under the shared source operation budget.
 * @param source - Complete validated storage and resource policy.
 * @param reader - Existing document-wide property reader.
 * @returns Independent source section intervals and ordered property operations.
 */
export function readSectionRecords(source: WordDocumentSource, reader: PropertyReader): readonly WordSectionRecord[] {
  const { table, word, header, storage, limits } = source
  const range = header.records[6]!
  requireDoc(range.length >= 20, 'invalid-paragraph-data', 'Section settings require an explicit section table')
  readSectionEnds(table, header, storage.text, limits)
  const count = (range.length - 4) / 16
  const view = new ByteView(new ByteView(table, 'invalid-paragraph-data').slice(range.offset, range.length), 'invalid-paragraph-data')
  const document = new ByteView(word, 'invalid-formatting-data')
  const result: WordSectionRecord[] = []
  for (let index = 0; index < count; index++) {
    const offset = view.u32((count + 1) * 4 + index * 12 + 2)
    requireDoc(offset <= 0x7fffffff && offset >= header.headerLength, 'invalid-formatting-data', 'Invalid section property offset')
    const length = document.u16(offset)
    requireDoc(length <= 0x7fff, 'invalid-formatting-data', 'Negative section property length')
    const operations = reader.read(document.slice(offset + 2, length))
    reader.consume(operations.length)
    requireDoc(operations.every(operation => (operation.opcode >>> 10 & 7) === 4),
      'invalid-formatting-data', 'Non-section operation in SEPX')
    result.push({ start: view.u32(index * 4), end: Math.min(view.u32((index + 1) * 4), header.stories[0]!.end), operations })
  }
  return result
}
