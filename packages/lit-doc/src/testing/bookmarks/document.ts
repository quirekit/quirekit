import type { BookmarkTableFixture } from './types'

/**
 * Encodes explicit names, starts and end slots without candidate parsing.
 * @param streams - Original Word and selected table streams, left unchanged.
 * @param fixture - Authored independent table facts.
 * @returns New streams with complete FIB locators.
 */
export function withBookmarkTables(streams: Record<string, Uint8Array>, fixture: BookmarkTableFixture): Record<string, Uint8Array> {
  const tableName = streams['1Table'] ? '1Table' : '0Table'
  const original = streams[tableName]!
  const word = streams.WordDocument!.slice(), fib = new DataView(word.buffer)
  const namesSize = 6 + fixture.entries.reduce((size, entry) => size + 2 + entry.name.length * 2, 0)
  const startSize = 4 + 8 * fixture.entries.length, endSize = 4 + 4 * fixture.ends.length
  const table = new Uint8Array(original.length + namesSize + startSize + endSize)
  table.set(original)
  const data = new DataView(table.buffer)
  let offset = original.length
  data.setUint16(offset, fixture.extend ?? 0xffff, true)
  data.setUint16(offset + 2, fixture.nameCount ?? fixture.entries.length, true)
  data.setUint16(offset + 4, fixture.extraBytes ?? 0, true)
  let nameOffset = offset + 6
  for (const entry of fixture.entries) {
    data.setUint16(nameOffset, entry.name.length, true)
    for (let unit = 0; unit < entry.name.length; unit++) data.setUint16(nameOffset + 2 + unit * 2, entry.name.charCodeAt(unit), true)
    nameOffset += 2 + entry.name.length * 2
  }
  for (const [index, size] of [[21, namesSize], [22, startSize], [23, endSize]] as const) {
    fib.setUint32(154 + index * 8, offset, true)
    fib.setUint32(158 + index * 8, size, true)
    offset += size
  }
  offset = original.length + namesSize
  fixture.entries.forEach((entry, index) => {
    data.setUint32(offset + index * 4, entry.start, true)
    data.setUint16(offset + (fixture.entries.length + 1) * 4 + index * 4, entry.endIndex, true)
    data.setUint16(offset + (fixture.entries.length + 1) * 4 + index * 4 + 2, entry.rawFlags ?? 0x4000, true)
  })
  data.setUint32(offset + fixture.entries.length * 4, fixture.startTerminal ?? 0xffffffff, true)
  offset += startSize
  fixture.ends.forEach((end, index) => data.setUint32(offset + index * 4, end, true))
  data.setUint32(offset + fixture.ends.length * 4, fixture.endTerminal ?? 0xffffffff, true)
  return { ...streams, WordDocument: word, [tableName]: table }
}
