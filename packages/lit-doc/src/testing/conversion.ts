import { readFileSync } from 'node:fs'
import { readDocumentSource } from '../word/document/read'

/**
 * Supplies an owned font table and coherent source page tuple to a normative vector.
 * @param streams - Independent source text/style/index records.
 * @param end - Exact main-story ending CP.
 * @returns Complete source streams required by the actual conversion API.
 */
export function conversionRecords(streams: Record<string, Uint8Array>, end: number): Record<string, Uint8Array> {
  const native = readDocumentSource(new Uint8Array(readFileSync(new URL('./fixtures/word-mac/chinese-basic.doc', import.meta.url))), {})
  const range = native.header.records[15]!
  const fonts = native.table.subarray(range.offset, range.offset + range.length)
  const propertiesRange = native.header.records[31]!
  const properties = native.table.subarray(propertiesRange.offset, propertiesRange.offset + propertiesRange.length)
  const sectionRange = native.header.records[6]!
  const nativeTable = new DataView(native.table.buffer, native.table.byteOffset, native.table.byteLength)
  const sectionCount = (sectionRange.length - 4) / 16
  const nativeOffset = nativeTable.getUint32(sectionRange.offset + (sectionCount + 1) * 4 + 2, true)
  const nativeWord = new DataView(native.word.buffer, native.word.byteOffset, native.word.byteLength)
  const page = native.word.subarray(nativeOffset, nativeOffset + 2 + nativeWord.getUint16(nativeOffset, true))
  const oldWord = streams.WordDocument!, oldTable = streams['1Table']!
  const word = new Uint8Array(oldWord.length + page.length), table = new Uint8Array(oldTable.length + fonts.length + 20 + properties.length)
  word.set(oldWord); table.set(oldTable); table.set(fonts, oldTable.length)
  word.set(page, oldWord.length)
  const fib = new DataView(word.buffer), section = new DataView(table.buffer)
  fib.setUint32(64, word.length, true)
  fib.setUint32(154 + 15 * 8, oldTable.length, true); fib.setUint32(158 + 15 * 8, fonts.length, true)
  const offset = oldTable.length + fonts.length
  fib.setUint32(154 + 6 * 8, offset, true); fib.setUint32(158 + 6 * 8, 20, true)
  section.setUint32(offset + 4, end, true); section.setUint32(offset + 10, oldWord.length, true)
  table.set(properties, offset + 20)
  fib.setUint32(154 + 31 * 8, offset + 20, true); fib.setUint32(158 + 31 * 8, properties.length, true)
  return { ...streams, WordDocument: word, '1Table': table }
}
