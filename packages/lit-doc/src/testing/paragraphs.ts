/**
 * Adds independently encoded paragraph pages and section CPs to a synthetic Word stream.
 * @param streams - Original fixture streams, never modified.
 * @param pages - Physical FC cuts and optional paragraph property payloads per page.
 * @param sectionEnds - Exclusive section CPs, defaulting to the main story end.
 * @returns Separate streams carrying explicit FIB locators and binary record vectors.
 */
export function withParagraphRecords(streams: Record<string, Uint8Array>, pages: readonly {
  cuts: readonly number[], records?: readonly { style?: number, bytes?: readonly number[], odd?: boolean, absent?: boolean }[],
}[], sectionEnds?: readonly number[]): Record<string, Uint8Array> {
  const source = streams.WordDocument!
  const name = streams['1Table'] ? '1Table' : '0Table'
  const oldTable = streams[name]!
  const mainEnd = new DataView(source.buffer, source.byteOffset).getUint32(76, true)
  const ends = sectionEnds ?? [mainEnd]
  const pageStart = Math.ceil(source.length / 512) * 512
  const word = new Uint8Array(pageStart + pages.length * 512)
  word.set(source)
  const table = new Uint8Array(oldTable.length + 4 + pages.length * 8 + 4 + ends.length * 16)
  table.set(oldTable)
  const data = new DataView(word.buffer)
  const index = new DataView(table.buffer)
  data.setUint32(64, word.length, true)
  data.setUint32(154 + 13 * 8, oldTable.length, true)
  data.setUint32(158 + 13 * 8, 4 + pages.length * 8, true)

  // FCs and page numbers are encoded independently of logical CP order.
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p]!
    const offset = pageStart + p * 512
    const count = page.cuts.length - 1
    index.setUint32(oldTable.length + p * 4, page.cuts[0]!, true)
    index.setUint32(oldTable.length + (pages.length + 1) * 4 + p * 4, offset / 512, true)
    if (p === pages.length - 1) index.setUint32(oldTable.length + pages.length * 4, page.cuts[count]!, true)
    word[offset + 511] = count
    page.cuts.forEach((fc, i) => data.setUint32(offset + i * 4, fc, true))
    let payload = 400
    for (let r = 0; r < count; r++) {
      const record = page.records?.[r] ?? {}
      if (record.absent) continue
      const bytes = record.bytes ?? []
      const length = 2 + bytes.length
      word[offset + (count + 1) * 4 + r * 13] = payload / 2
      if (record.odd) word[offset + payload] = (length + 1) / 2
      else { word[offset + payload] = 0; word[offset + payload + 1] = length / 2 }
      const start = offset + payload + (record.odd ? 1 : 2)
      data.setUint16(start, record.style ?? 0, true)
      word.set(bytes, start + 2)
      payload += Math.ceil((length + 2) / 2) * 2
    }
  }

  // Section endpoints distinguish authored page breaks from true section endings.
  const section = oldTable.length + 4 + pages.length * 8
  data.setUint32(154 + 6 * 8, section, true)
  data.setUint32(158 + 6 * 8, 4 + ends.length * 16, true)
  index.setUint32(section, 0, true)
  ends.forEach((end, i) => index.setUint32(section + (i + 1) * 4, end, true))
  return { ...streams, WordDocument: word, [name]: table }
}
