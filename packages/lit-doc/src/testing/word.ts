/**
 * Builds independent FIB/CLX vectors; no production reader generates the expectations.
 * @param spans - Code units and their source encoding, in logical order.
 * @param options - Focused version, story and physical-order variations.
 * @returns Root stream bytes for the synthetic compound-file builder.
 */
export function wordStreams(spans: readonly { units: readonly number[], unicode: boolean }[], options: {
  version?: number, storyLengths?: readonly number[], reversePhysical?: boolean, table?: '0Table' | '1Table',
} = {}): Record<string, Uint8Array> {
  const version = options.version ?? 0xc1
  const fieldCount = new Map([[0xc1, 93], [0xd9, 108], [0x101, 136], [0x10c, 164], [0x112, 183]]).get(version) ?? 93
  const newWords = version === 0xc1 ? 0 : version === 0x112 ? 5 : 2
  const unitCount = spans.reduce((sum, span) => sum + span.units.length, 0)
  const byteCount = spans.reduce((sum, span) => sum + span.units.length * (span.unicode ? 2 : 1), 0)
  const word = new Uint8Array(Math.max(4096, Math.ceil((2048 + byteCount) / 512) * 512))
  const table = new Uint8Array(9 + spans.length * 12)
  const view = new DataView(word.buffer)
  const tableView = new DataView(table.buffer)
  const tableName = options.table ?? '1Table'

  // All counted FIB regions are written explicitly, including the optional newer version.
  view.setUint16(0, 0xa5ec, true); view.setUint16(2, 0xc1, true)
  view.setUint16(10, tableName === '1Table' ? 0x1200 : 0x1000, true)
  view.setUint16(12, 0xbf, true); view.setUint16(32, 14, true)
  view.setUint16(62, 22, true); view.setUint32(64, 2048 + byteCount, true)
  const counts = options.storyLengths ?? [unitCount, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < 7; i++) view.setUint32(64 + [3, 4, 5, 7, 8, 9, 10][i]! * 4, counts[i]!, true)
  view.setUint16(152, fieldCount, true)
  view.setUint32(154 + 33 * 8, 0, true)
  view.setUint32(154 + 33 * 8 + 4, table.length, true)
  view.setUint16(154 + fieldCount * 8, newWords, true)
  if (newWords) view.setUint16(156 + fieldCount * 8, version, true)
  else view.setUint16(2, version, true)

  // Logical CP order is independent of the order in which source bytes are stored.
  tableView.setUint8(0, 2); tableView.setUint32(1, table.length - 5, true)
  const positions = new Map<number, number>()
  let physical = 2048
  const order = spans.map((_, index) => index)
  if (options.reversePhysical) order.reverse()
  for (const index of order) {
    const span = spans[index]!
    positions.set(index, physical)
    for (const unit of span.units) {
      if (span.unicode) view.setUint16(physical, unit, true)
      else view.setUint8(physical, unit)
      physical += span.unicode ? 2 : 1
    }
  }
  let cp = 0
  for (let index = 0; index < spans.length; index++) {
    const span = spans[index]!
    tableView.setUint32(5 + index * 4, cp, true)
    cp += span.units.length
    const descriptor = 5 + (spans.length + 1) * 4 + index * 8
    const position = positions.get(index)!
    tableView.setUint32(descriptor + 2, span.unicode ? position : position * 2 + 0x40000000, true)
  }
  tableView.setUint32(5 + spans.length * 4, cp, true)
  return { WordDocument: word, [tableName]: table }
}
