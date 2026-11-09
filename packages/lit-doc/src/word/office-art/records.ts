import { ByteView } from '../../binary/bytes'
import type { OfficeArtReadContext, OfficeArtRecord } from './types'

/** @param bytes - Exact enclosing extent. @param offset - Record offset in that extent. @param context - Shared work budget. @returns Complete bounded record. */
export function readOfficeArtRecord(bytes: Uint8Array, offset: number, context: OfficeArtReadContext): OfficeArtRecord {
  context.reader.consume(1)
  const view = new ByteView(bytes, context.errorCode)
  view.check(offset, 8)
  const options = view.u16(offset), length = view.u32(offset + 4)
  const data = view.slice(offset + 8, length)
  return { type: view.u16(offset + 2), version: options & 15, instance: options >>> 4, data, end: offset + 8 + length }
}

/** @param bytes - Exact record sequence. @param context - Shared source work budget. @returns All complete records in physical order. */
export function readOfficeArtRecords(bytes: Uint8Array, context: OfficeArtReadContext): OfficeArtRecord[] {
  const result: OfficeArtRecord[] = []
  for (let offset = 0; offset < bytes.length;) {
    const record = readOfficeArtRecord(bytes, offset, context)
    result.push(record)
    offset = record.end
  }
  return result
}
