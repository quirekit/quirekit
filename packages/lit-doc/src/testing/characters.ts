/**
 * Encodes independent character-formatting pages and their physical index.
 * @param streams - Existing synthetic document streams.
 * @param pages - Explicit FC partitions with raw operation bytes or absent records.
 * @returns New streams with FIB locator twelve pointing at the CHPX index.
 */
export function withCharacterRecords(streams: Record<string, Uint8Array>, pages: readonly {
  cuts: readonly number[], records?: readonly (readonly number[] | undefined)[],
}[]): Record<string, Uint8Array> {
  const source = streams.WordDocument!
  const name = streams['1Table'] ? '1Table' : '0Table'
  const old = streams[name]!
  const pageStart = Math.ceil(source.length / 512) * 512
  const word = new Uint8Array(pageStart + pages.length * 512)
  word.set(source)
  const table = new Uint8Array(old.length + 4 + pages.length * 8)
  table.set(old)
  const fib = new DataView(word.buffer)
  const index = new DataView(table.buffer)
  fib.setUint32(64, word.length, true)
  fib.setUint32(154 + 12 * 8, old.length, true)
  fib.setUint32(158 + 12 * 8, 4 + pages.length * 8, true)
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]!
    const offset = pageStart + p * 512
    const count = page.cuts.length - 1
    index.setUint32(old.length + p * 4, page.cuts[0]!, true)
    index.setUint32(old.length + (pages.length + 1) * 4 + p * 4, offset / 512, true)
    if (p === pages.length - 1) index.setUint32(old.length + pages.length * 4, page.cuts[count]!, true)
    word[offset + 511] = count
    page.cuts.forEach((fc, i) => fib.setUint32(offset + i * 4, fc, true))
    let payload = 300
    for (let r = 0; r < count; r++) {
      const bytes = page.records?.[r]
      if (bytes === undefined) continue
      word[offset + (count + 1) * 4 + r] = payload / 2
      word[offset + payload] = bytes.length
      word.set(bytes, offset + payload + 1)
      payload += Math.ceil((bytes.length + 1) / 2) * 2
    }
  }
  return { ...streams, WordDocument: word, [name]: table }
}
