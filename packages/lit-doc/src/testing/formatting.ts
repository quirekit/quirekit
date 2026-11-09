/**
 * Encodes independent style records, including empty reserved slots and inherited paragraph properties.
 * @param streams - Existing synthetic Word streams.
 * @param definitions - Explicit style indexes, bases and property bytes.
 * @param extended - Whether to use the later 18-byte style header.
 * @param fonts - Optional three or four source default font slots.
 * @returns New streams carrying a standalone STSH at FIB locator one.
 */
export function withStyleDefinitions(streams: Record<string, Uint8Array>, definitions: readonly {
  index: number, parent?: number, kind?: number, properties?: readonly number[], characters?: readonly number[],
}[], extended = false, fonts: readonly number[] = [0, 0, 0]): Record<string, Uint8Array> {
  const count = Math.max(15, ...definitions.map(style => style.index + 1))
  const records: number[] = []
  for (let index = 0; index < count; index++) {
    const definition = definitions.find(style => style.index === index)
    if (!definition) { records.push(0, 0); continue }
    const headerSize = extended ? 18 : 10
    const kind = definition.kind ?? 1
    const properties = definition.properties ?? []
    const groups = kind === 1 ? [[index & 255, index >> 8, ...properties], definition.characters ?? []]
      : [definition.characters ?? properties]
    const record = new Uint8Array(headerSize + 6 + groups.reduce((size, bytes) => size + 2 + bytes.length + bytes.length % 2, 0))
    const data = new DataView(record.buffer)
    data.setUint16(0, index === 0 ? 0 : 0xffe, true)
    data.setUint16(2, ((definition.parent ?? 0xfff) << 4) | kind, true)
    data.setUint16(4, (index << 4) | groups.length, true)
    data.setUint16(headerSize, 1, true)
    data.setUint16(headerSize + 2, 65 + index, true)
    let position = headerSize + 6
    for (const bytes of groups) {
      data.setUint16(position, bytes.length, true)
      record.set(bytes, position + 2)
      position += 2 + bytes.length + bytes.length % 2
    }
    records.push(record.length & 255, record.length >> 8, ...record)
  }
  const styleHeader = fonts.length === 4 ? 20 : 18
  const style = new Uint8Array(styleHeader + 2 + records.length)
  const data = new DataView(style.buffer)
  data.setUint16(0, styleHeader, true); data.setUint16(2, count, true)
  data.setUint16(4, extended ? 18 : 10, true)
  data.setUint16(6, 1, true); data.setUint16(10, 15, true)
  fonts.forEach((font, index) => data.setUint16(14 + index * 2, font, true))
  style.set(records, styleHeader + 2)
  const name = streams['1Table'] ? '1Table' : '0Table'
  const old = streams[name]!
  const table = new Uint8Array(old.length + style.length)
  table.set(old); table.set(style, old.length)
  const word = streams.WordDocument!.slice()
  const fib = new DataView(word.buffer)
  fib.setUint32(154 + 8, old.length, true); fib.setUint32(158 + 8, style.length, true)
  return { ...streams, WordDocument: word, [name]: table }
}

/**
 * Encodes one explicitly sized property operation for a normative test vector.
 * @param code - Full format-defined opcode.
 * @param operand - Exact operand bytes, including any length prefix.
 * @returns Complete operation bytes.
 */
export function operation(code: number, ...operand: number[]): number[] {
  return [code & 255, code >> 8, ...operand]
}

/**
 * Adds a CLX property group and assigns it to one explicitly chosen source piece.
 * @param streams - Existing independent Word streams.
 * @param group - Exact operation bytes in the new first property group.
 * @param pieceIndex - Logical piece whose Prm becomes the group reference.
 * @returns New streams with a relocated, length-prefixed CLX.
 */
export function withPiecePropertyGroup(streams: Record<string, Uint8Array>, group: readonly number[], pieceIndex: number): Record<string, Uint8Array> {
  const name = streams['1Table'] ? '1Table' : '0Table'
  const old = streams[name]!
  const word = streams.WordDocument!.slice()
  const fib = new DataView(word.buffer)
  const offset = fib.getUint32(154 + 33 * 8, true)
  const length = fib.getUint32(158 + 33 * 8, true)
  const clx = new Uint8Array(3 + group.length + length)
  const view = new DataView(clx.buffer)
  clx[0] = 1; view.setUint16(1, group.length, true)
  clx.set(group, 3); clx.set(old.subarray(offset, offset + length), 3 + group.length)
  const count = (view.getUint32(4 + group.length, true) - 4) / 12
  view.setUint16(3 + group.length + 5 + (count + 1) * 4 + pieceIndex * 8 + 6, 1, true)
  const table = new Uint8Array(old.length + clx.length)
  table.set(old); table.set(clx, old.length)
  fib.setUint32(154 + 33 * 8, old.length, true); fib.setUint32(158 + 33 * 8, clx.length, true)
  return { ...streams, WordDocument: word, [name]: table }
}
