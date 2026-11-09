import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { PhysicalPropertyRecord } from '../properties/types'

/**
 * Reads a complete CHPX page without interpreting its property operations.
 * @param bytes - Exactly 512 source bytes.
 * @returns Strictly ordered physical character property records.
 */
export function readCharacterPage(bytes: Uint8Array): readonly PhysicalPropertyRecord[] {
  const source = new ByteView(bytes, 'invalid-formatting-data')
  requireDoc(bytes.length === 512, 'invalid-formatting-data', 'Character formatting page must contain 512 bytes')
  const count = source.u8(511)
  requireDoc(count >= 1 && count <= 101, 'invalid-formatting-data', 'Invalid character formatting page count')
  const metadataEnd = (count + 1) * 4 + count
  const records: PhysicalPropertyRecord[] = []
  for (let i = 0; i < count; i++) {
    const byteStart = source.u32(i * 4)
    const byteEnd = source.u32((i + 1) * 4)
    requireDoc(byteStart < byteEnd, 'invalid-formatting-data', 'Character FC boundaries must strictly increase')
    const offset = source.u8((count + 1) * 4 + i) * 2
    let properties: Uint8Array = new Uint8Array(0)
    if (offset) {
      requireDoc(offset >= metadataEnd && offset < 511, 'invalid-formatting-data', 'Character properties overlap page metadata')
      const length = source.u8(offset)
      requireDoc(offset + 1 + length <= 511, 'invalid-formatting-data', 'Character properties exceed page data')
      properties = source.slice(offset + 1, length)
    }
    records.push({ byteStart, byteEnd, properties })
  }
  return records
}
