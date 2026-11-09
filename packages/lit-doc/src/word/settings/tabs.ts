import { ByteView } from '../../binary/bytes'
import type { WordHeader } from '../types'

/**
 * Reads DOPBase's signed tab interval without inventing an absent source value.
 * @param table - FIB-selected table stream.
 * @param header - Validated DOP locator.
 * @returns Original twips, or null when no DOP is stored.
 */
export function readDefaultTabInterval(table: Uint8Array, header: WordHeader): number | null {
  const range = header.records[31]!
  if (!range.length) return null
  const source = new ByteView(new ByteView(table, 'invalid-formatting-data').slice(range.offset, range.length), 'invalid-formatting-data')
  return source.u16(10) << 16 >> 16
}
