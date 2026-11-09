import { wordStreams } from '../word'

/**
 * Encodes an independent revision author STTB in its declared FIB slot.
 * @param authors - Exact source names, or no source table when absent.
 * @returns Complete root streams for actual public source inspection.
 */
export function revisionAuthorStreams(authors?: readonly string[]): Record<string, Uint8Array> {
  const streams = wordStreams([{ units: [65, 13], unicode: true }])
  if (authors === undefined) return streams
  return withRevisionAuthors(streams, authors)
}

/**
 * Appends an independently encoded author directory without changing existing Story or property records.
 * @param streams - Original independently constructed root streams.
 * @param authors - Exact original slots, including empty or whitespace names.
 * @returns New Table stream with FIB 51 pointing only at the appended directory.
 */
export function withRevisionAuthors(streams: Record<string, Uint8Array>, authors: readonly string[]): Record<string, Uint8Array> {
  const old = streams['1Table']!, size = 6 + authors.reduce((total, name) => total + 2 + name.length * 2, 0)
  const table = new Uint8Array(old.length + size), data = new DataView(table.buffer)
  table.set(old)
  data.setUint16(old.length, 0xffff, true)
  data.setUint16(old.length + 2, authors.length, true)
  let offset = old.length + 6
  for (const name of authors) {
    data.setUint16(offset, name.length, true)
    for (let index = 0; index < name.length; index++) data.setUint16(offset + 2 + index * 2, name.charCodeAt(index), true)
    offset += 2 + name.length * 2
  }
  const wordBytes = streams.WordDocument!.slice(), word = new DataView(wordBytes.buffer)
  word.setUint32(154 + 51 * 8, old.length, true)
  word.setUint32(158 + 51 * 8, size, true)
  return { ...streams, WordDocument: wordBytes, '1Table': table }
}
