import { wordStreams } from '../word'

/**
 * Writes independent DOP and SEPX vectors without invoking production property readers.
 * @param version - Effective FIB version.
 * @param sections - Ordered section property bytes, one or two sections.
 * @param settings - Optional original DOP bytes, omitted to test absent settings.
 * @returns Complete streams for settings-only public inspection.
 */
export function noteSettingsStreams(version: number, sections: readonly (readonly number[])[] = [[]],
  settings?: Uint8Array): Record<string, Uint8Array> {
  const text = sections.length === 1 ? 'A\r' : 'A\fB\r'
  const source = wordStreams([{ units: [...text].map(character => character.charCodeAt(0)), unicode: true }], { version })
  const sectionLength = 4 + sections.length * 16
  const table = new Uint8Array(source['1Table']!.length + sectionLength + (settings?.length ?? 0))
  table.set(source['1Table']!)
  const word = new Uint8Array(source.WordDocument!.length + sections.reduce((sum, bytes) => sum + 2 + bytes.length, 0))
  word.set(source.WordDocument!)
  const fib = new DataView(word.buffer)
  const records = new DataView(table.buffer)
  const sectionStart = source['1Table']!.length
  fib.setUint32(64, word.length, true)
  fib.setUint32(154 + 6 * 8, sectionStart, true)
  fib.setUint32(158 + 6 * 8, sectionLength, true)
  let offset = source.WordDocument!.length
  for (const [index, bytes] of sections.entries()) {
    records.setUint32(sectionStart + (index + 1) * 4, (index + 1) * 2, true)
    records.setUint32(sectionStart + (sections.length + 1) * 4 + index * 12 + 2, offset, true)
    fib.setUint16(offset, bytes.length, true)
    word.set(bytes, offset + 2)
    offset += 2 + bytes.length
  }
  if (settings) {
    table.set(settings, sectionStart + sectionLength)
    fib.setUint32(154 + 31 * 8, sectionStart + sectionLength, true)
    fib.setUint32(158 + 31 * 8, settings.length, true)
  }
  return { WordDocument: word, '1Table': table }
}

/**
 * Replaces note settings and appends explicit section overrides to a complete owned conversion vector.
 * @param streams - One-section vector with existing formatting and page properties.
 * @param version - Effective Word 97 or Word 2002 version.
 * @param settings - Independent DOP bytes.
 * @param operations - Additional ordered section operations.
 * @returns New streams retaining all existing content and format indexes.
 */
export function withNoteSettings(streams: Record<string, Uint8Array>, version: 0xc1 | 0x101,
  settings: Uint8Array, operations: readonly number[] = []): Record<string, Uint8Array> {
  const oldWord = streams.WordDocument!
  const oldTable = streams['1Table']!
  const sourceFib = new DataView(oldWord.buffer, oldWord.byteOffset, oldWord.byteLength)
  const sourceTable = new DataView(oldTable.buffer, oldTable.byteOffset, oldTable.byteLength)
  const directory = sourceFib.getUint32(154 + 6 * 8, true)
  const oldSection = sourceTable.getUint32(directory + 10, true)
  const oldLength = sourceFib.getUint16(oldSection, true)
  const word = new Uint8Array(oldWord.length + 2 + oldLength + operations.length)
  const table = new Uint8Array(oldTable.length + settings.length)
  word.set(oldWord)
  table.set(oldTable)
  table.set(settings, oldTable.length)
  const fib = new DataView(word.buffer)
  const count = version === 0xc1 ? 93 : 136
  fib.setUint16(152, count, true)
  fib.setUint16(154 + count * 8, version === 0xc1 ? 0 : 2, true)
  if (version !== 0xc1) fib.setUint16(156 + count * 8, version, true)
  fib.setUint32(64, word.length, true)
  fib.setUint32(154 + 31 * 8, oldTable.length, true)
  fib.setUint32(158 + 31 * 8, settings.length, true)
  fib.setUint16(oldWord.length, oldLength + operations.length, true)
  word.set(oldWord.subarray(oldSection + 2, oldSection + 2 + oldLength), oldWord.length + 2)
  word.set(operations, oldWord.length + 2 + oldLength)
  new DataView(table.buffer).setUint32(directory + 10, oldWord.length, true)
  return { ...streams, WordDocument: word, '1Table': table }
}
