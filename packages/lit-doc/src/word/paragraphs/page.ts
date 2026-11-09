import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { ParagraphPropertyRecord } from './types'

/**
 * Reads a paragraph-formatting page while retaining opaque direct-property payloads.
 * @param bytes - Exactly one 512-byte page from WordDocument.
 * @returns Physical property ranges in ascending FC order.
 */
export function readParagraphPage(bytes: Uint8Array): readonly ParagraphPropertyRecord[] {
  const view = new ByteView(bytes, 'invalid-paragraph-data')
  requireDoc(bytes.length === 512, 'invalid-paragraph-data', 'Paragraph formatting page must contain 512 bytes')
  const count = view.u8(511)
  requireDoc(count >= 1 && count <= 29, 'invalid-paragraph-data', 'Invalid paragraph formatting page count')
  const metadataEnd = (count + 1) * 4 + count * 13
  const result: ParagraphPropertyRecord[] = []
  for (let index = 0; index < count; index++) {
    const byteStart = view.u32(index * 4)
    const byteEnd = view.u32((index + 1) * 4)
    requireDoc(byteStart < byteEnd, 'invalid-paragraph-data', 'Paragraph FC boundaries must strictly increase')
    const offset = view.u8((count + 1) * 4 + index * 13) * 2
    let styleIndex = 0
    let properties: Uint8Array = new Uint8Array(0)
    if (offset !== 0) {
      // A zero pointer is the absent record, unlike a zero length prefix, which
      // selects the even-length encoding. Neither may consume the page's tables.
      requireDoc(offset >= metadataEnd && offset < 511, 'invalid-paragraph-data', 'Paragraph properties overlap page metadata')
      const prefix = view.u8(offset)
      const start = offset + (prefix ? 1 : 2)
      const length = prefix ? prefix * 2 - 1 : view.u8(offset + 1) * 2
      requireDoc(length >= 2 && start + length <= 511, 'invalid-paragraph-data', 'Paragraph property envelope exceeds page data')
      styleIndex = view.u16(start)
      properties = view.slice(start + 2, length - 2)
    }
    result.push({ byteStart, byteEnd, styleIndex, properties })
  }
  return result
}
