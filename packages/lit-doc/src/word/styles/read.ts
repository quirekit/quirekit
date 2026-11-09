import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { WordHeader } from '../types'
import type { WordStyleRecord, WordStylesSource } from './types'

/**
 * Reads stylesheet envelopes without interpreting character, table or revision payloads.
 * @param table - FIB-selected Table stream.
 * @param header - Validated style-sheet locator.
 * @returns Fixed-index style slots and bounded compatibility diagnostics.
 */
export function readWordStyles(table: Uint8Array, header: WordHeader): WordStylesSource {
  const range = header.records[1]!
  requireDoc(range.length > 0, 'invalid-formatting-data', 'Paragraph formatting requires a stylesheet')
  const declared = new ByteView(new ByteView(table, 'invalid-formatting-data').slice(range.offset, range.length), 'invalid-formatting-data')
  const headerSize = declared.u16(0)
  requireDoc(headerSize >= 18 && headerSize % 2 === 0, 'invalid-formatting-data', 'Invalid stylesheet header size')
  declared.check(2, headerSize)
  const count = declared.u16(2)
  const fixed = declared.u16(4)
  requireDoc(count >= 15 && count < 0xffe && (fixed === 10 || fixed === 18),
    'invalid-formatting-data', 'Unsupported stylesheet record counts or header size')

  // A stale FIB extent may omit the final counted style. Recovery remains inside
  // the Table stream and cannot consume bytes owned by the next located region.
  let boundary = table.length
  for (const record of header.records) {
    if (record.length > 0 && record.offset > range.offset) boundary = Math.min(boundary, record.offset)
  }
  const source = new ByteView(table.subarray(range.offset, Math.max(range.offset + range.length, boundary)), 'invalid-formatting-data')
  const result: (WordStyleRecord | undefined)[] = []
  let position = 2 + headerSize
  for (let index = 0; index < count; index++) {
    const size = source.u16(position)
    requireDoc(size <= 0x7fff, 'invalid-formatting-data', 'Negative style record size')
    const bytes = source.slice(position + 2, size)
    position += 2 + size + size % 2
    source.check(position, 0)
    if (!size) { result.push(undefined); continue }
    result.push(readStyle(bytes, fixed, index))
  }
  return { styles: result, diagnostics: position > range.length ? [{ code: 'extended-stylesheet-range',
    message: 'Complete counted styles extend beyond the declared stylesheet length within the next source-region boundary.' }] : [] }
}

/**
 * Locates typed UPX payloads after a bounded UTF-16 style name.
 * @param bytes - One style definition, excluding its length prefix.
 * @param fixed - Stdf header width from STSHI.
 * @param index - Source slot used to validate the paragraph UPX owner.
 * @returns Uncompiled style metadata.
 */
function readStyle(bytes: Uint8Array, fixed: number, index: number): WordStyleRecord {
  const source = new ByteView(bytes, 'invalid-formatting-data')
  const kind = source.u16(2) & 15
  const parent = source.u16(2) >>> 4
  const count = source.u16(4) & 15
  requireDoc(kind >= 1 && kind <= 4, 'invalid-formatting-data', 'Unknown stylesheet kind')
  requireDoc(kind === 1 ? count === 2 || count === 3 : kind === 2 ? count === 1 || count === 2
    : kind === 3 ? count === 3 : count === 1, 'invalid-formatting-data', 'Invalid style property-set count')
  const nameLength = source.u16(fixed)
  requireDoc(nameLength > 0, 'invalid-formatting-data', 'Style name must not be empty')
  let position = fixed + 2 + nameLength * 2
  requireDoc(source.u16(position) === 0, 'invalid-formatting-data', 'Unterminated style name')
  position += 2
  const propertySets: Uint8Array[] = []
  let paragraph: Uint8Array = new Uint8Array(0)
  let character: Uint8Array = new Uint8Array(0)
  for (let i = 0; i < count; i++) {
    const size = source.u16(position)
    const payload = source.slice(position + 2, size)
    propertySets.push(payload)
    if (kind === 1 && i === 0) {
      requireDoc(size >= 2 && new ByteView(payload, 'invalid-formatting-data').u16(0) === index,
        'invalid-formatting-data', 'Paragraph style payload has the wrong owner')
      paragraph = payload.subarray(2)
    }
    if (kind === 1 && i === 1 || kind === 2 && i === 0) character = payload
    position += 2 + size + size % 2
    source.check(position, 0)
  }
  return { kind, parent, paragraph, character, propertySets, metadataBytes: source.slice(8, fixed - 8), nameBytes: source.slice(fixed + 2, nameLength * 2),
    next: source.u16(4) >>> 4, builtinId: source.u16(0) & 0xfff }
}
