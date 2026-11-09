import type { FieldTableFixture } from './types'

/**
 * Appends independently encoded PLC positions and records to a synthetic source.
 * @param streams - Original streams, retained unchanged.
 * @param tables - Explicit normative marker facts, including deliberate malformed variants.
 * @returns New streams with separately written FIB locators.
 */
export function withFieldTables(streams: Record<string, Uint8Array>, tables: readonly FieldTableFixture[]): Record<string, Uint8Array> {
  const indexes = { main: 16, header: 17, footnote: 18, comment: 19, endnote: 48, textbox: 57, headerTextbox: 59 }
  const name = streams['1Table'] ? '1Table' : '0Table'
  const original = streams[name]!
  const word = streams.WordDocument!.slice()
  const table = new Uint8Array(original.length + tables.reduce((total, field) => total + 4 + 6 * field.tokens.length, 0))
  table.set(original)
  const fib = new DataView(word.buffer), data = new DataView(table.buffer)
  let offset = original.length
  for (const source of tables) {
    const count = source.tokens.length
    const size = 4 + 6 * count
    fib.setUint32(154 + indexes[source.kind] * 8, offset, true)
    fib.setUint32(158 + indexes[source.kind] * 8, size, true)
    source.tokens.forEach((token, index) => {
      data.setUint32(offset + 4 * index, token.position, true)
      data.setUint8(offset + (count + 1) * 4 + 2 * index, token.code)
      data.setUint8(offset + (count + 1) * 4 + 2 * index + 1, token.value)
    })
    data.setUint32(offset + count * 4, source.terminal ?? (count ? source.tokens[count - 1]!.position + 3 : 0), true)
    offset += size
  }
  return { ...streams, WordDocument: word, [name]: table }
}
