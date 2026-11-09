/**
 * Adds declared zero capacity after the first font's complete existing name area.
 * @param streams - Owned complete synthetic Word streams with a font table.
 * @param count - Additional zero UTF-16 code units in the first font record.
 * @returns Source streams whose other records and indexes remain byte-for-byte intact.
 */
export function withFontNamePadding(streams: Record<string, Uint8Array>, count: number): Record<string, Uint8Array> {
  const word = streams.WordDocument!.slice()
  const fib = new DataView(word.buffer)
  const table = streams['1Table']!
  const start = fib.getUint32(154 + 15 * 8, true)
  const length = fib.getUint32(158 + 15 * 8, true)
  const original = table.subarray(start, start + length)
  const end = 5 + original[4]!
  const fonts = new Uint8Array(length + count * 2)
  fonts.set(original.subarray(0, end))
  fonts.set(original.subarray(end), end + count * 2)
  fonts[4] = original[4]! + count * 2
  const combined = new Uint8Array(table.length + fonts.length)
  combined.set(table)
  combined.set(fonts, table.length)
  fib.setUint32(154 + 15 * 8, table.length, true)
  fib.setUint32(158 + 15 * 8, fonts.length, true)
  return { ...streams, WordDocument: word, '1Table': combined }
}
